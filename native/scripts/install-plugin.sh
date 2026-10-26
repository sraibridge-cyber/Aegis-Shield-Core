#!/usr/bin/env bash
# Copy the AegisKeystore and HullTelemetry plugins into the generated Android
# project and register both in MainActivity.
#
# `npx cap add android` generates the Android project; it is not checked in.
# This script copies the plugin Java sources into the generated app module and
# registers the plugins in MainActivity. It is idempotent.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID="$ROOT/android"
KEYSTORE="$ROOT/plugins/aegis-keystore/android/src/main/java/io/aegis/keystore"
TELEMETRY="$ROOT/plugins/hull-telemetry/android/src/main/java/io/aegis/telemetry"

if [ ! -d "$ANDROID" ]; then
  echo "install-plugin: native/android does not exist. Run 'npx cap add android' first." >&2
  exit 1
fi

DEST_KS="$ANDROID/app/src/main/java/io/aegis/keystore"
DEST_TEL="$ANDROID/app/src/main/java/io/aegis/telemetry"
mkdir -p "$DEST_KS" "$DEST_TEL"
cp "$KEYSTORE/AegisKeystorePlugin.java" "$DEST_KS/"
cp "$KEYSTORE/EcdsaDer.java" "$DEST_KS/"
cp "$TELEMETRY/HullTelemetryPlugin.java" "$DEST_TEL/"

MAIN="$(find "$ANDROID/app/src/main/java" -name MainActivity.java -print -quit)"
if [ -z "$MAIN" ]; then
  echo "install-plugin: MainActivity.java not found under $ANDROID/app/src/main/java" >&2
  exit 1
fi

python3 - "$MAIN" <<'PY'
import re
import sys

path = sys.argv[1]
source = open(path, encoding="utf-8").read()
if "AegisKeystorePlugin" in source and "HullTelemetryPlugin" in source:
    print("install-plugin: plugins already registered")
    sys.exit(0)

package = re.search(r"^package\s+([\w.]+);", source, re.M)
if not package:
    raise SystemExit("install-plugin: package declaration not found")

pkg = package.group(1)
source = f'''package {pkg};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.aegis.keystore.AegisKeystorePlugin;
import io.aegis.telemetry.HullTelemetryPlugin;

public class MainActivity extends BridgeActivity {{
    @Override
    public void onCreate(Bundle savedInstanceState) {{
        registerPlugin(AegisKeystorePlugin.class);
        registerPlugin(HullTelemetryPlugin.class);
        super.onCreate(savedInstanceState);
    }}
}}
'''
open(path, "w", encoding="utf-8", newline="").write(source)
print("install-plugin: registered AegisKeystorePlugin and HullTelemetryPlugin in MainActivity")
PY

echo "install-plugin: copied plugin sources to $DEST_KS and $DEST_TEL"
