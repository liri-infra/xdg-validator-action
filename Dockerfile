FROM python:3-alpine

RUN apk add desktop-file-utils appstream-glib

# We could use appstream-glib from Flathub but the installation takes time
# and consumes ~350 MiB, so for now we use the package from Alpine
#flatpak remote-add --system --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
#flatpak install -y --system org.freedesktop.appstream-glib

ADD requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

ADD entrypoint /entrypoint

ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["/entrypoint"]
