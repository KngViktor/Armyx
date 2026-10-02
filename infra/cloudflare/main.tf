# =============================================================================
# Cloudflare edge configuration (Terraform, provider v4).
#   terraform init && terraform apply -var zone_id=... -var account_id=...
#
# Layers, outermost first:
#   DDoS (always on) -> WAF managed + custom rules -> bot management ->
#   rate limiting -> waiting room (recruitment paths) -> cache -> origin
# =============================================================================
terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 4.40" }
  }
}

variable "zone_id" { type = string }
variable "account_id" { type = string }
variable "domain" {
  type    = string
  default = "army.mil.ng"
}
variable "waiting_room_active_users" {
  description = "Concurrent active portal users admitted before queueing. Size from load tests (docs/LOAD-TESTING.md)."
  type        = number
  default     = 60000
}

# ------------------------------------------------------------------ TLS & zone hardening
resource "cloudflare_zone_settings_override" "this" {
  zone_id = var.zone_id
  settings {
    ssl                      = "strict"
    always_use_https         = "on"
    min_tls_version          = "1.2"
    tls_1_3                  = "zrt"
    automatic_https_rewrites = "on"
    http3                    = "on"
    brotli                   = "on"
    security_level           = "medium"
    browser_check            = "on"
    opportunistic_encryption = "on"
    security_header {
      enabled            = true
      max_age            = 63072000
      include_subdomains = true
      preload            = true
      nosniff            = true
    }
  }
}

# Origin only accepts Cloudflare-signed client certificates (see ingress.yaml).
resource "cloudflare_authenticated_origin_pulls" "this" {
  zone_id = var.zone_id
  enabled = true
}

# ------------------------------------------------------------------ WAF
resource "cloudflare_ruleset" "waf_managed" {
  zone_id = var.zone_id
  name    = "Managed WAF"
  kind    = "zone"
  phase   = "http_request_firewall_managed"
  rules {
    action      = "execute"
    expression  = "true"
    description = "Cloudflare Managed Ruleset"
    action_parameters { id = "efb7b8c949ac4650a09736fc376e9aee" }
  }
  rules {
    action      = "execute"
    expression  = "true"
    description = "OWASP Core Ruleset"
    action_parameters { id = "4814384a9e5d4991b9815dcfc25d2f1f" }
  }
}

resource "cloudflare_ruleset" "waf_custom" {
  zone_id = var.zone_id
  name    = "Custom firewall rules"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
  rules {
    action      = "block"
    description = "Admin API and console only from approved networks (HQ / VPN egress IPs)"
    expression  = "(starts_with(http.request.uri.path, \"/api/v1/admin\") or starts_with(http.request.uri.path, \"/admin\")) and not ip.src in $armyx_admin_ips"
  }
  rules {
    action      = "block"
    description = "Block non-browser methods on the website"
    expression  = "not http.request.method in {\"GET\" \"HEAD\" \"POST\" \"PUT\" \"PATCH\" \"DELETE\" \"OPTIONS\"}"
  }
  rules {
    action      = "managed_challenge"
    description = "Challenge likely-automated traffic on sign-up/sign-in (Bot Management score)"
    expression  = "(http.request.uri.path in {\"/api/v1/auth/register\" \"/api/v1/auth/login\" \"/api/v1/auth/password/forgot\"}) and cf.bot_management.score lt 30 and not cf.bot_management.verified_bot"
  }
  rules {
    action      = "block"
    description = "Block requests for common exploit paths"
    expression  = "http.request.uri.path contains \"/.env\" or http.request.uri.path contains \"/wp-admin\" or http.request.uri.path contains \"/.git\""
  }
}

resource "cloudflare_list" "admin_ips" {
  account_id = var.account_id
  name       = "armyx_admin_ips"
  kind       = "ip"
  item {
    value { ip = "192.0.2.0/24" } # placeholder: Army HQ / VPN egress ranges
  }
}

# ------------------------------------------------------------------ Rate limiting (edge, per IP)
resource "cloudflare_ruleset" "rate_limits" {
  zone_id = var.zone_id
  name    = "Rate limits"
  kind    = "zone"
  phase   = "http_ratelimit"
  rules {
    action      = "block"
    description = "Login: 20 req/min per IP"
    expression  = "http.request.uri.path in {\"/api/v1/auth/login\" \"/api/v1/admin/auth/login\"}"
    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 60
      requests_per_period = 20
      mitigation_timeout  = 600
    }
  }
  rules {
    action      = "block"
    description = "OTP send/verify: 10 req/min per IP (SMS pumping protection)"
    expression  = "starts_with(http.request.uri.path, \"/api/v1/auth/otp\") or http.request.uri.path eq \"/api/v1/auth/register\""
    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 60
      requests_per_period = 10
      mitigation_timeout  = 600
    }
  }
  rules {
    action      = "managed_challenge"
    description = "API general: 300 req/min per IP (NAT-friendly; challenge not block)"
    expression  = "starts_with(http.request.uri.path, \"/api/v1/\")"
    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 60
      requests_per_period = 300
      mitigation_timeout  = 60
    }
  }
}

# ------------------------------------------------------------------ Caching
resource "cloudflare_ruleset" "cache" {
  zone_id = var.zone_id
  name    = "Cache rules"
  kind    = "zone"
  phase   = "http_request_cache_settings"
  rules {
    action      = "set_cache_settings"
    description = "Public website: cache HTML at the edge (purged by the CMS on publish)"
    expression  = "not starts_with(http.request.uri.path, \"/api/\") and not starts_with(http.request.uri.path, \"/portal\") and not starts_with(http.request.uri.path, \"/admin\")"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 3600
      }
      browser_ttl { mode = "respect_origin" }
      serve_stale { disable_stale_while_updating = false }
    }
  }
  rules {
    action      = "set_cache_settings"
    description = "Portal/admin app shells are static (no user data) — cache briefly"
    expression  = "(starts_with(http.request.uri.path, \"/portal\") or starts_with(http.request.uri.path, \"/admin\")) and not http.cookie contains \"__never\""
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 300
      }
    }
  }
  rules {
    action      = "set_cache_settings"
    description = "Reference data API honours origin Cache-Control (public, s-maxage)"
    expression  = "starts_with(http.request.uri.path, \"/api/v1/reference/\")"
    action_parameters {
      cache = true
      edge_ttl { mode = "respect_origin" }
    }
  }
  rules {
    action      = "set_cache_settings"
    description = "Everything else under /api is never cached"
    expression  = "starts_with(http.request.uri.path, \"/api/\")"
    action_parameters { cache = false }
  }
}

# ------------------------------------------------------------------ Bots & CAPTCHA
resource "cloudflare_bot_management" "this" {
  zone_id           = var.zone_id
  enable_js         = true
  fight_mode        = false
  auto_update_model = true
}

resource "cloudflare_turnstile_widget" "portal" {
  account_id = var.account_id
  name       = "Recruitment portal"
  domains    = [var.domain, "www.${var.domain}"]
  mode       = "managed"
}

# ------------------------------------------------------------------ Virtual waiting room
# Queues visitors at the edge when the portal is at capacity instead of letting
# the origin fall over. FIFO, with a custom branded queue page.
resource "cloudflare_waiting_room" "portal" {
  zone_id                   = var.zone_id
  name                      = "recruitment_portal"
  host                      = var.domain
  path                      = "/portal"
  additional_routes {
    host = var.domain
    path = "/api/v1/applications"
  }
  additional_routes {
    host = var.domain
    path = "/api/v1/auth"
  }
  total_active_users        = var.waiting_room_active_users
  new_users_per_minute      = 8000
  session_duration          = 15
  queueing_method           = "fifo"
  queueing_status_code      = 202
  disable_session_renewal   = false
  json_response_enabled     = true # API calls get JSON (the portal client shows its queue banner)
  default_template_language = "en-US"
  custom_page_html          = file("${path.module}/waiting-room.html")
}

output "turnstile_site_key" { value = cloudflare_turnstile_widget.portal.id }
