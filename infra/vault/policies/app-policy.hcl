# AgriTrade application policy — read-only access to own secrets
# Applied to the AppRole used by backend services at runtime.
# Services should NEVER have root or write access to Vault.

# Read app secrets
path "secret/agritrade/*" {
  capabilities = ["read", "list"]
}

# Allow token self-renewal (so services can keep their token alive)
path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Allow token lookup (so services can verify expiry)
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# Explicitly deny anything else
path "*" {
  capabilities = ["deny"]
}
