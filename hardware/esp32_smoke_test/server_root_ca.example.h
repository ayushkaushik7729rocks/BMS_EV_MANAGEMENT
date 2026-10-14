// Copy to server_root_ca.h (ignored by Git). Replace this template with the
// complete PEM certificate for the trusted root CA that issued your HTTPS cert.
// Obtain it from the CA's official source; do not paste a self-signed leaf cert.
#pragma once

static const char *SERVER_ROOT_CA = R"EVG_CA(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_COMPLETE_TRUSTED_ROOT_CA_PEM
-----END CERTIFICATE-----
)EVG_CA";
