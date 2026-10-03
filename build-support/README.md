# build-support

Optional files used only during `docker build`.

- `ca-bundle.crt` — if present, it is added to Node's trusted CA store
  (`NODE_EXTRA_CA_CERTS`) inside the build and runtime stages. Put your
  organisation's TLS-inspecting proxy CA here when building behind such a
  proxy. The file is git-ignored; do not commit it.
