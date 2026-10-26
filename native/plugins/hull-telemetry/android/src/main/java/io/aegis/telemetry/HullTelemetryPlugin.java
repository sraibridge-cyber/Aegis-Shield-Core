package io.aegis.telemetry;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.KeyguardManager;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.biometrics.BiometricManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.WifiManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Debug;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.StatFs;
import android.os.SystemClock;
import android.provider.Settings;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(
    name = "HullTelemetry",
    permissions = {
        @com.getcapacitor.annotation.Permission(alias = "ble", strings = {Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}),
        @com.getcapacitor.annotation.Permission(alias = "wifi", strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.NEARBY_WIFI_DEVICES})
    }
)
public class HullTelemetryPlugin extends Plugin {
    private static final String ALIAS = "aegis.sealA";
    private static final long SENSOR_WINDOW_MS = 2000L;
    private static final long BLE_WINDOW_MS = 10000L;

    private JSObject envelope(boolean ok, String code, String detail, Object value,
                              String unit, String api, String permissionRequired,
                              String permissionState) {
        JSObject out = new JSObject();
        out.put("ok", ok);
        if (code != null) out.put("code", code);
        if (detail != null) out.put("detail", detail);
        if (value != null) out.put("value", value);
        if (unit != null) out.put("unit", unit);
        JSObject p = new JSObject();
        p.put("api", api);
        p.put("backend", "android");
        p.put("apiLevel", Build.VERSION.SDK_INT);
        p.put("elapsedRealtimeMs", SystemClock.elapsedRealtime());
        p.put("wallClockMs", System.currentTimeMillis());
        if (permissionRequired != null) p.put("permissionRequired", permissionRequired);
        if (permissionState != null) p.put("permissionState", permissionState);
        out.put("provenance", p);
        return out;
    }

    private String permissionState(String permission) {
        if (permission == null) return "n/a";
        Context ctx = getContext();
        if (ContextCompat.checkSelfPermission(ctx, permission) == PackageManager.PERMISSION_GRANTED) return "granted";
        try {
            ctx.getPackageManager().getPermissionInfo(permission, 0);
        } catch (PackageManager.NameNotFoundException e) {
            return "not_declared";
        }
        return "denied";
    }

    private boolean has(String permission) {
        return permission == null || ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isForeground() {
        try {
            Activity activity = getActivity();
            return activity != null && activity.hasWindowFocus();
        } catch (Exception e) {
            return false;
        }
    }

    private JSObject screenOff(String api) {
        return envelope(false, "SCREEN_OFF", "The app is not in the foreground; collection is suspended.", null, null, api, null, "n/a");
    }
    private JSArray sensorNames(int[] types) {
        JSArray a = new JSArray();
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) return a;
        for (int t : types) {
            Sensor s = sm.getDefaultSensor(t);
            if (s != null) a.put(s.getName());
        }
        return a;
    }
    private static String sensorKey(int type) {
        switch (type) {
            case Sensor.TYPE_LIGHT: return "light";
            case Sensor.TYPE_PRESSURE: return "pressure";
            case Sensor.TYPE_PROXIMITY: return "proximity";
            case Sensor.TYPE_AMBIENT_TEMPERATURE: return "ambientTemperature";
            case Sensor.TYPE_RELATIVE_HUMIDITY: return "relativeHumidity";
            default: return "unknown";
        }
    }

    private JSObject group(String id, String api, String permission, boolean available, String reason) {
        JSObject g = new JSObject();
        g.put("group", id);
        g.put("available", available);
        g.put("api", api);
        g.put("apiLevel", Build.VERSION.SDK_INT);
        g.put("permissionRequired", permission);
        g.put("permissionState", permissionState(permission));
        if (reason != null) g.put("reason", reason);
        return g;
    }

    @PluginMethod
    public void probe(PluginCall call) {
        JSArray groups = new JSArray();
        groups.put(group("VITALS", "BatteryManager/PowerManager/ActivityManager/StatFs/SystemClock/Runtime/Debug", null, true, null));
        JSObject motionGroup = group("MOTION", "SensorManager (accelerometer/gyroscope/magnetometer/rotation vector)", null, true, null);
        motionGroup.put("sensors", sensorNames(new int[]{Sensor.TYPE_ACCELEROMETER, Sensor.TYPE_GYROSCOPE, Sensor.TYPE_MAGNETIC_FIELD, Sensor.TYPE_ROTATION_VECTOR}));
        groups.put(motionGroup);
        JSObject envGroup = group("ENVIRONMENT", "SensorManager (light/pressure/proximity/ambient temperature/relative humidity)", null, true, null);
        envGroup.put("sensors", sensorNames(new int[]{Sensor.TYPE_LIGHT, Sensor.TYPE_PRESSURE, Sensor.TYPE_PROXIMITY, Sensor.TYPE_AMBIENT_TEMPERATURE, Sensor.TYPE_RELATIVE_HUMIDITY}));
        groups.put(envGroup);
        groups.put(group("RF_BLE", "BluetoothLeScanner.startScan (passive, receive-only)", Manifest.permission.BLUETOOTH_SCAN, Build.VERSION.SDK_INT >= 31, Build.VERSION.SDK_INT < 31 ? "UNSUPPORTED_API_LEVEL" : null));
        groups.put(group("RF_WIFI", "WifiManager.getScanResults (opt-in, passive)", Manifest.permission.ACCESS_FINE_LOCATION, Build.VERSION.SDK_INT >= 23, null));
        groups.put(group("ATTEST", "KeyStore.getCertificateChain + Android key attestation extension", null, true, null));
        groups.put(group("POSTURE", "KeyguardManager/BiometricManager/Settings/PowerManager", null, true, null));
        groups.put(group("CLOCK_INTEGRITY", "System.currentTimeMillis + SystemClock.elapsedRealtime", null, true, null));
        JSObject value = new JSObject();
        value.put("groups", groups);
        value.put("apiLevel", Build.VERSION.SDK_INT);
        value.put("backend", "android");
        call.resolve(envelope(true, null, null, value, null, "HullTelemetry.probe", null, "n/a"));
    }

    @PluginMethod
    public void vitals(PluginCall call) {
        if (!isForeground()) { call.resolve(screenOff("HullTelemetry.vitals")); return; }
        JSObject v = new JSObject();
        try {
            BatteryManager bm = (BatteryManager) getContext().getSystemService(Context.BATTERY_SERVICE);
            if (bm != null) {
                JSObject battery = new JSObject();
                battery.put("levelPercent", bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY));
                battery.put("currentNowMicroAmp", bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW));
                battery.put("chargeCounterMicroAmpHour", bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER));
                Intent batt = getContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                if (batt != null) {
                    battery.put("status", batt.getIntExtra(BatteryManager.EXTRA_STATUS, -1));
                    battery.put("plugged", batt.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1));
                    int t = batt.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
                    battery.put("temperatureC", t == Integer.MIN_VALUE ? "UNAVAILABLE" : (t / 10.0));
                    battery.put("voltageMv", batt.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1));
                }
                v.put("battery", battery);
            }
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                JSObject thermal = new JSObject();
                if (Build.VERSION.SDK_INT >= 29) {
                    thermal.put("status", pm.getCurrentThermalStatus());
                    thermal.put("apiLevel", 29);
                    thermal.put("listenerAvailable", Build.VERSION.SDK_INT >= 30);
                } else {
                    thermal.put("status", "UNSUPPORTED_API_LEVEL");
                    thermal.put("apiLevel", Build.VERSION.SDK_INT);
                }
                v.put("thermal", thermal);
            }
            ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
            if (am != null) {
                ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
                am.getMemoryInfo(mi);
                JSObject mem = new JSObject();
                mem.put("availMem", mi.availMem);
                mem.put("totalMem", mi.totalMem);
                mem.put("lowMemory", mi.lowMemory);
                mem.put("threshold", mi.threshold);
                v.put("memory", mem);
            }
            JSObject storage = new JSObject();
            storage.put("filesDir", statFs(getContext().getFilesDir()));
            File ext = getContext().getExternalFilesDir(null);
            if (ext != null) storage.put("externalFilesDir", statFs(ext));
            v.put("storage", storage);
            JSObject uptime = new JSObject();
            uptime.put("elapsedRealtimeMs", SystemClock.elapsedRealtime());
            uptime.put("uptimeMillis", SystemClock.uptimeMillis());
            v.put("uptime", uptime);
            JSObject cpu = new JSObject();
            cpu.put("availableProcessors", Runtime.getRuntime().availableProcessors());
            cpu.put("loadAvg", readLoadAvg());
            cpu.put("procStatDelta", readProcStatDelta());
            v.put("cpu", cpu);
            Debug.MemoryInfo dmi = new Debug.MemoryInfo();
            Debug.getMemoryInfo(dmi);
            JSObject app = new JSObject();
            app.put("totalPssKb", dmi.getTotalPss());
            app.put("threadCount", Thread.activeCount());
            v.put("appProcess", app);
            v.put("requestedWindowMs", 200);
            v.put("achievedRateHz", 0);
            v.put("droppedSamples", 0);
            call.resolve(envelope(true, null, null, v, null, "HullTelemetry.vitals", null, "n/a"));
        } catch (Exception e) {
            call.resolve(envelope(false, "RESTRICTED_BY_OS", e.getClass().getSimpleName() + ": " + e.getMessage(), null, null, "HullTelemetry.vitals", null, "n/a"));
        }
    }

    private JSObject statFs(File dir) {
        JSObject o = new JSObject();
        try {
            StatFs s = new StatFs(dir.getAbsolutePath());
            o.put("totalBytes", s.getTotalBytes());
            o.put("availableBytes", s.getAvailableBytes());
            o.put("path", dir.getAbsolutePath());
        } catch (Exception e) {
            o.put("error", e.getClass().getSimpleName());
        }
        return o;
    }

    private String readLoadAvg() {
        try {
            byte[] b = new byte[128];
            java.io.FileInputStream in = new java.io.FileInputStream("/proc/loadavg");
            int n = in.read(b);
            in.close();
            return n > 0 ? new String(b, 0, n).trim() : "unreadable";
        } catch (Exception e) {
            return "unreadable: " + e.getClass().getSimpleName();
        }
    }

    private long[] readProcStat() throws Exception {
        BufferedReader r = new BufferedReader(new FileReader("/proc/stat"));
        String line = r.readLine();
        r.close();
        String[] p = line.trim().split("\\s+");
        long total = 0, idle = 0;
        for (int i = 1; i < p.length; i++) {
            long v = Long.parseLong(p[i]);
            total += v;
            if (i == 4 || i == 5) idle += v;
        }
        return new long[]{total, idle};
    }

    private JSObject readProcStatDelta() {
        JSObject o = new JSObject();
        try {
            long[] a = readProcStat();
            Thread.sleep(200L);
            long[] b = readProcStat();
            long total = b[0] - a[0], idle = b[1] - a[1];
            o.put("windowMs", 200);
            o.put("totalDelta", total);
            o.put("idleDelta", idle);
            o.put("busyDelta", total - idle);
            o.put("busyPercent", total > 0 ? Math.round((total - idle) * 1000.0 / total) / 10.0 : -1);
        } catch (Exception e) {
            o.put("error", e.getClass().getSimpleName());
        }
        return o;
    }

    @PluginMethod
    public void thermalStream(PluginCall call) {
        if (!isForeground()) { call.resolve(screenOff("HullTelemetry.thermalStream")); return; }
        if (Build.VERSION.SDK_INT < 30) {
            call.resolve(envelope(false, "UNSUPPORTED_API_LEVEL", "ThermalService listener requires API 30+.", null, null, "HullTelemetry.thermalStream", null, "n/a"));
            return;
        }
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        if (pm == null) {
            call.resolve(envelope(false, "RESTRICTED_BY_OS", "PowerManager is unavailable.", null, null, "HullTelemetry.thermalStream", null, "n/a"));
            return;
        }
        final JSArray changes = new JSArray();
        final CountDownLatch latch = new CountDownLatch(1);
        final Handler handler = new Handler(Looper.getMainLooper());
        PowerManager.OnThermalStatusChangedListener listener = status -> {
            JSObject o = new JSObject();
            o.put("status", status);
            o.put("elapsedRealtimeMs", SystemClock.elapsedRealtime());
            changes.put(o);
        };
        pm.addThermalStatusListener(listener);
        handler.postDelayed(() -> { pm.removeThermalStatusListener(listener); latch.countDown(); }, 2000L);
        try { latch.await(2500, TimeUnit.MILLISECONDS); } catch (InterruptedException ignored) { }
        JSObject out = new JSObject();
        out.put("changes", changes);
        out.put("requestedWindowMs", 2000);
        out.put("achievedRateHz", Math.round(changes.length() * 1000.0 / 2000.0 * 10.0) / 10.0);
        out.put("droppedSamples", 0);
        call.resolve(envelope(true, null, null, out, null, "HullTelemetry.thermalStream", null, "n/a"));
    }

    @PluginMethod
    public void motion(PluginCall call) {
        if (!isForeground()) { call.resolve(screenOff("HullTelemetry.motion")); return; }
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) {
            call.resolve(envelope(false, "SENSOR_ABSENT", "SensorManager is not present.", null, null, "HullTelemetry.motion", null, "n/a"));
            return;
        }
        int[] types = {Sensor.TYPE_ACCELEROMETER, Sensor.TYPE_GYROSCOPE, Sensor.TYPE_MAGNETIC_FIELD, Sensor.TYPE_ROTATION_VECTOR};
        String[] names = {"accelerometer", "gyroscope", "magnetometer", "rotationVector"};
        JSObject out = new JSObject();
        JSArray present = new JSArray();
        JSArray absent = new JSArray();
        for (int i = 0; i < types.length; i++) {
            if (sm.getDefaultSensor(types[i]) == null) absent.put(names[i]);
            else present.put(names[i]);
        }
        out.put("present", present);
        out.put("absent", absent);
        final CountDownLatch latch = new CountDownLatch(1);
        final JSObject samples = new JSObject();
        final java.util.Map<String, Integer> counts = new java.util.HashMap<>();
        final Handler handler = new Handler(Looper.getMainLooper());
        SensorEventListener listener = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent event) {
                String key = event.sensor.getType() == Sensor.TYPE_ACCELEROMETER ? "accelerometer"
                    : event.sensor.getType() == Sensor.TYPE_GYROSCOPE ? "gyroscope"
                    : event.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD ? "magnetometer" : "rotationVector";
                JSObject s = new JSObject();
                JSArray vals = new JSArray();
                for (float f : event.values) { try { vals.put(f); } catch (Exception ignored) { } }
                s.put("values", vals);
                s.put("elapsedRealtimeNanos", event.timestamp);
                samples.put(key, s);
                counts.put(key, counts.containsKey(key) ? counts.get(key) + 1 : 1);
            }
            @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        for (int i = 0; i < types.length; i++) {
            Sensor s = sm.getDefaultSensor(types[i]);
            if (s != null) sm.registerListener(listener, s, SensorManager.SENSOR_DELAY_GAME);
        }
        handler.postDelayed(() -> {
            sm.unregisterListener(listener);
            latch.countDown();
        }, SENSOR_WINDOW_MS);
        try { latch.await(SENSOR_WINDOW_MS + 500, TimeUnit.MILLISECONDS); } catch (InterruptedException ignored) { }
        out.put("samples", samples);
        JSObject countObj = new JSObject();
        for (java.util.Map.Entry<String, Integer> e : counts.entrySet()) countObj.put(e.getKey(), e.getValue());
        out.put("counts", countObj);
        int total = 0;
        for (int c : counts.values()) total += c;
        out.put("requestedWindowMs", SENSOR_WINDOW_MS);
        out.put("achievedRateHz", Math.round(total * 1000.0 / SENSOR_WINDOW_MS * 10.0) / 10.0);
        out.put("droppedSamples", 0);
        call.resolve(envelope(true, null, null, out, null, "HullTelemetry.motion", null, "n/a"));
    }

    @PluginMethod
    public void environment(PluginCall call) {
        if (!isForeground()) { call.resolve(screenOff("HullTelemetry.environment")); return; }
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) {
            call.resolve(envelope(false, "SENSOR_ABSENT", "SensorManager is not present.", null, null, "HullTelemetry.environment", null, "n/a"));
            return;
        }
        int[] types = {Sensor.TYPE_LIGHT, Sensor.TYPE_PRESSURE, Sensor.TYPE_PROXIMITY, Sensor.TYPE_AMBIENT_TEMPERATURE, Sensor.TYPE_RELATIVE_HUMIDITY};
        String[] names = {"light", "pressure", "proximity", "ambientTemperature", "relativeHumidity"};
        String[] units = {"lx", "hPa", "cm", "C", "%"};
        final java.util.Map<String, Float> values = new java.util.HashMap<>();
        final java.util.Map<String, Integer> counts = new java.util.HashMap<>();
        final Handler handler = new Handler(Looper.getMainLooper());
        SensorEventListener listener = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent event) {
                String key = sensorKey(event.sensor.getType());
                values.put(key, event.values[0]);
                counts.put(key, counts.containsKey(key) ? counts.get(key) + 1 : 1);
            }
            @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        for (int i = 0; i < types.length; i++) {
            Sensor s = sm.getDefaultSensor(types[i]);
            if (s != null) sm.registerListener(listener, s, SensorManager.SENSOR_DELAY_NORMAL, handler);
        }
        try { Thread.sleep(1000L); } catch (InterruptedException ignored) { }
        sm.unregisterListener(listener);
        JSObject out = new JSObject();
        int total = 0;
        for (int i = 0; i < types.length; i++) {
            Sensor s = sm.getDefaultSensor(types[i]);
            if (s == null) {
                JSObject miss = new JSObject();
                miss.put("ok", false);
                miss.put("code", "SENSOR_ABSENT");
                miss.put("detail", "No " + names[i] + " sensor on this device.");
                out.put(names[i], miss);
                continue;
            }
            if (!values.containsKey(names[i])) {
                JSObject miss = new JSObject();
                miss.put("ok", false);
                miss.put("code", "TIMEOUT");
                miss.put("detail", "No " + names[i] + " sample within 1000 ms.");
                out.put(names[i], miss);
                continue;
            }
            JSObject reading = new JSObject();
            reading.put("ok", true);
            reading.put("value", values.get(names[i]));
            reading.put("unit", units[i]);
            reading.put("sensorName", s.getName());
            reading.put("vendor", s.getVendor());
            reading.put("maxRange", s.getMaximumRange());
            reading.put("resolution", s.getResolution());
            reading.put("power", s.getPower());
            out.put(names[i], reading);
            total += counts.get(names[i]);
        }
        out.put("requestedWindowMs", 1000);
        out.put("achievedRateHz", Math.round(total * 1000.0 / 1000.0 * 10.0) / 10.0);
        out.put("droppedSamples", 0);
        call.resolve(envelope(true, null, null, out, null, "HullTelemetry.environment", null, "n/a"));
    }

    @PluginMethod
    public void rfBle(PluginCall call) {
        if (!isForeground()) { call.resolve(screenOff("HullTelemetry.rfBle")); return; }
        if (!has(Manifest.permission.BLUETOOTH_SCAN)) {
            call.resolve(envelope(false, "PERMISSION_DENIED", "BLUETOOTH_SCAN is not granted. Request it from the RF_BLE control.", null, null, "HullTelemetry.rfBle", Manifest.permission.BLUETOOTH_SCAN, permissionState(Manifest.permission.BLUETOOTH_SCAN)));
            return;
        }
        BluetoothManager bm = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = bm == null ? null : bm.getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.resolve(envelope(false, "RESTRICTED_BY_OS", "Bluetooth adapter is absent or disabled.", null, null, "HullTelemetry.rfBle", Manifest.permission.BLUETOOTH_SCAN, permissionState(Manifest.permission.BLUETOOTH_SCAN)));
            return;
        }
        BluetoothLeScanner scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) {
            call.resolve(envelope(false, "RESTRICTED_BY_OS", "BluetoothLeScanner is unavailable.", null, null, "HullTelemetry.rfBle", Manifest.permission.BLUETOOTH_SCAN, permissionState(Manifest.permission.BLUETOOTH_SCAN)));
            return;
        }
        final JSArray ads = new JSArray();
        final JSObject seen = new JSObject();
        final boolean canName = has(Manifest.permission.BLUETOOTH_CONNECT);
        final long start = SystemClock.elapsedRealtime();
        final CountDownLatch latch = new CountDownLatch(1);
        final Handler handler = new Handler(Looper.getMainLooper());
        ScanCallback cb = new ScanCallback() {
            @Override public void onScanResult(int callbackType, ScanResult result) {
                try {
                    String address = result.getDevice().getAddress();
                    String key = sha256(address);
                    long now = SystemClock.elapsedRealtime();
                    JSObject a = seen.has(key) ? (JSObject) seen.get(key) : new JSObject();
                    a.put("addressHash", key);
                    a.put("rssi", result.getRssi());
                    a.put("txPower", result.getTxPower());
                    if (canName && result.getScanRecord() != null) a.put("name", result.getScanRecord().getDeviceName());
                    if (!seen.has(key)) a.put("firstSeenElapsedMs", now - start);
                    a.put("lastSeenElapsedMs", now - start);
                    seen.put(key, a);
                } catch (Exception ignored) { }
            }
            @Override public void onBatchScanResults(List<ScanResult> results) {
                for (ScanResult r : results) onScanResult(0, r);
            }
            @Override public void onScanFailed(int errorCode) {
                latch.countDown();
            }
        };
        try {
            scanner.startScan(cb);
        } catch (SecurityException e) {
            call.resolve(envelope(false, "PERMISSION_DENIED", "SecurityException: " + e.getMessage(), null, null, "HullTelemetry.rfBle", Manifest.permission.BLUETOOTH_SCAN, permissionState(Manifest.permission.BLUETOOTH_SCAN)));
            return;
        }
        handler.postDelayed(() -> {
            try { scanner.stopScan(cb); } catch (Exception ignored) { }
            latch.countDown();
        }, BLE_WINDOW_MS);
        try { latch.await(BLE_WINDOW_MS + 500, TimeUnit.MILLISECONDS); } catch (InterruptedException ignored) { }
        java.util.Iterator<String> seenKeys = seen.keys();
        while (seenKeys.hasNext()) { String k = seenKeys.next(); try { ads.put(seen.get(k)); } catch (Exception ignored) { } }
        JSObject out = new JSObject();
        out.put("advertisements", ads);
        out.put("count", ads.length());
        out.put("windowMs", BLE_WINDOW_MS);
        out.put("requestedWindowMs", BLE_WINDOW_MS);
        out.put("achievedRateHz", Math.round(ads.length() * 1000.0 / BLE_WINDOW_MS * 10.0) / 10.0);
        out.put("droppedSamples", 0);
        out.put("connectUsed", canName);
        call.resolve(envelope(true, null, null, out, null, "HullTelemetry.rfBle", Manifest.permission.BLUETOOTH_SCAN, permissionState(Manifest.permission.BLUETOOTH_SCAN)));
    }

    @PluginMethod
    public void rfWifi(PluginCall call) {
        if (!isForeground()) { call.resolve(screenOff("HullTelemetry.rfWifi")); return; }
        if (!has(Manifest.permission.ACCESS_FINE_LOCATION)) {
            call.resolve(envelope(false, "PERMISSION_DENIED", "ACCESS_FINE_LOCATION is not granted. RF_WIFI is opt-in and requests it only from its own control.", null, null, "HullTelemetry.rfWifi", Manifest.permission.ACCESS_FINE_LOCATION, permissionState(Manifest.permission.ACCESS_FINE_LOCATION)));
            return;
        }
        WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm == null) {
            call.resolve(envelope(false, "RESTRICTED_BY_OS", "WifiManager is unavailable.", null, null, "HullTelemetry.rfWifi", Manifest.permission.ACCESS_FINE_LOCATION, permissionState(Manifest.permission.ACCESS_FINE_LOCATION)));
            return;
        }
        boolean started;
        try { started = wm.startScan(); } catch (SecurityException e) {
            call.resolve(envelope(false, "PERMISSION_DENIED", "SecurityException: " + e.getMessage(), null, null, "HullTelemetry.rfWifi", Manifest.permission.ACCESS_FINE_LOCATION, permissionState(Manifest.permission.ACCESS_FINE_LOCATION)));
            return;
        }
        if (!started) {
            call.resolve(envelope(false, "SCAN_THROTTLED", "Android refused the scan request; Wi-Fi scans are throttled to 4 per 2 minutes in the foreground.", null, null, "HullTelemetry.rfWifi", Manifest.permission.ACCESS_FINE_LOCATION, permissionState(Manifest.permission.ACCESS_FINE_LOCATION)));
            return;
        }
        List<android.net.wifi.ScanResult> results = wm.getScanResults();
        JSArray arr = new JSArray();
        for (android.net.wifi.ScanResult r : results) {
            JSObject o = new JSObject();
            o.put("bssidHash", sha256(r.BSSID == null ? "" : r.BSSID));
            if (r.SSID != null && !r.SSID.isEmpty()) o.put("ssid", r.SSID);
            o.put("frequencyMhz", r.frequency);
            o.put("rssi", r.level);
            o.put("capabilities", r.capabilities);
            arr.put(o);
        }
        JSObject out = new JSObject();
        out.put("networks", arr);
        out.put("count", arr.length());
        out.put("requestedWindowMs", 0);
        out.put("achievedRateHz", arr.length());
        out.put("droppedSamples", 0);
        call.resolve(envelope(true, null, null, out, null, "HullTelemetry.rfWifi", Manifest.permission.ACCESS_FINE_LOCATION, permissionState(Manifest.permission.ACCESS_FINE_LOCATION)));
    }

    @PluginMethod
    public void attest(PluginCall call) {
        if (!isForeground()) { call.resolve(screenOff("HullTelemetry.attest")); return; }
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            Certificate[] chain = ks.getCertificateChain(ALIAS);
            if (chain == null || chain.length == 0) {
                call.resolve(envelope(false, "ATTESTATION_UNPARSEABLE", "No certificate chain for alias " + ALIAS + ".", null, null, "HullTelemetry.attest", null, "n/a"));
                return;
            }
            X509Certificate leaf = (X509Certificate) chain[0];
            JSObject out = new JSObject();
            out.put("chainLength", chain.length);
            out.put("subject", leaf.getSubjectX500Principal().getName());
            out.put("issuer", leaf.getIssuerX500Principal().getName());
            out.put("notBefore", leaf.getNotBefore().getTime());
            out.put("notAfter", leaf.getNotAfter().getTime());
            out.put("fingerprint", Build.FINGERPRINT);
            out.put("model", Build.MODEL);
            out.put("securityPatch", Build.VERSION.SECURITY_PATCH);
            JSObject att = parseAttestation(leaf);
            out.put("attestation", att);
            out.put("requestedWindowMs", 0);
            out.put("achievedRateHz", 0);
            out.put("droppedSamples", 0);
            call.resolve(envelope(true, null, null, out, null, "HullTelemetry.attest", null, "n/a"));
        } catch (Exception e) {
            call.resolve(envelope(false, "ATTESTATION_UNPARSEABLE", e.getClass().getSimpleName() + ": " + e.getMessage(), null, null, "HullTelemetry.attest", null, "n/a"));
        }
    }

    @PluginMethod
    public void posture(PluginCall call) {
        if (!isForeground()) { call.resolve(screenOff("HullTelemetry.posture")); return; }
        JSObject out = new JSObject();
        try {
            KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
            out.put("deviceSecure", km != null && km.isDeviceSecure());
            if (Build.VERSION.SDK_INT >= 30) {
                BiometricManager bm = (BiometricManager) getContext().getSystemService(Context.BIOMETRIC_SERVICE);
                out.put("biometricCanAuthenticate", bm == null ? "UNAVAILABLE" : bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK));
            } else {
                out.put("biometricCanAuthenticate", "UNSUPPORTED_API_LEVEL");
            }
            int bootCount = Settings.Global.getInt(getContext().getContentResolver(), Settings.Global.BOOT_COUNT, -1);
            out.put("bootCount", bootCount);
            String androidId = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
            out.put("androidIdHash", sha256(androidId == null ? "" : androidId));
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            out.put("screenOn", pm != null && pm.isInteractive());
            out.put("batterySaver", pm != null && pm.isPowerSaveMode());
            out.put("requestedWindowMs", 0);
            out.put("achievedRateHz", 0);
            out.put("droppedSamples", 0);
            call.resolve(envelope(true, null, null, out, null, "HullTelemetry.posture", null, "n/a"));
        } catch (Exception e) {
            call.resolve(envelope(false, "RESTRICTED_BY_OS", e.getClass().getSimpleName() + ": " + e.getMessage(), null, null, "HullTelemetry.posture", null, "n/a"));
        }
    }

    @PluginMethod
    public void clockIntegrity(PluginCall call) {
        if (!isForeground()) { call.resolve(screenOff("HullTelemetry.clockIntegrity")); return; }
        JSArray pairs = new JSArray();
        long startWall = System.currentTimeMillis();
        long startElapsed = SystemClock.elapsedRealtime();
        for (int i = 0; i < 20; i++) {
            JSObject p = new JSObject();
            p.put("wallClockMs", System.currentTimeMillis());
            p.put("elapsedRealtimeMs", SystemClock.elapsedRealtime());
            pairs.put(p);
            try { Thread.sleep(100L); } catch (InterruptedException ignored) { }
        }
        long endWall = System.currentTimeMillis();
        long endElapsed = SystemClock.elapsedRealtime();
        long wallDelta = endWall - startWall;
        long elapsedDelta = endElapsed - startElapsed;
        JSObject out = new JSObject();
        out.put("pairs", pairs);
        out.put("windowMs", elapsedDelta);
        out.put("wallDeltaMs", wallDelta);
        out.put("elapsedDeltaMs", elapsedDelta);
        out.put("divergenceMs", wallDelta - elapsedDelta);
        out.put("requestedWindowMs", 2000);
        out.put("achievedRateHz", Math.round(pairs.length() * 1000.0 / Math.max(1, elapsedDelta) * 10.0) / 10.0);
        out.put("droppedSamples", 0);
        call.resolve(envelope(true, null, null, out, "ms", "HullTelemetry.clockIntegrity", null, "n/a"));
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        String group = call.getString("group", "");
        if ("RF_BLE".equals(group)) {
            requestPermissionForAlias("ble", call, "blePermissionCallback");
        } else if ("RF_WIFI".equals(group)) {
            requestPermissionForAlias("wifi", call, "wifiPermissionCallback");
        } else {
            JSObject v = new JSObject();
            v.put("group", group);
            v.put("permissionState", "n/a");
            call.resolve(envelope(true, null, "No runtime permission is required for " + group + ".", v, null, "HullTelemetry.requestPermission", null, "n/a"));
        }
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void blePermissionCallback(PluginCall call) {
        JSObject v = new JSObject();
        v.put("group", "RF_BLE");
        v.put("permissionState", permissionState(Manifest.permission.BLUETOOTH_SCAN));
        call.resolve(envelope(true, null, null, v, null, "HullTelemetry.requestPermission", Manifest.permission.BLUETOOTH_SCAN, permissionState(Manifest.permission.BLUETOOTH_SCAN)));
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void wifiPermissionCallback(PluginCall call) {
        JSObject v = new JSObject();
        v.put("group", "RF_WIFI");
        v.put("permissionState", permissionState(Manifest.permission.ACCESS_FINE_LOCATION));
        call.resolve(envelope(true, null, null, v, null, "HullTelemetry.requestPermission", Manifest.permission.ACCESS_FINE_LOCATION, permissionState(Manifest.permission.ACCESS_FINE_LOCATION)));
    }

    private static String sha256(String input) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format(Locale.US, "%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return "unavailable";
        }
    }

    private JSObject parseAttestation(X509Certificate leaf) {
        JSObject o = new JSObject();
        try {
            byte[] ext = leaf.getExtensionValue("1.3.6.1.4.1.11129.2.1.17");
            if (ext == null) {
                o.put("ok", false);
                o.put("code", "ATTESTATION_UNPARSEABLE");
                o.put("detail", "The Android key attestation extension is absent from the leaf certificate.");
                return o;
            }
            // The extension is an OCTET STRING wrapping a DER SEQUENCE. This is a
            // bounded, best-effort scan for the documented context-specific tags:
            // 701 attestationSecurityLevel, 702 verifiedBootState, 703 challenge,
            // 705 deviceLocked. A full ASN.1 parser is intentionally not claimed.
            o.put("ok", true);
            o.put("extensionBytes", ext.length);
            o.put("securityLevel", scanEnum(ext, 701));
            o.put("verifiedBootState", scanEnum(ext, 702));
            o.put("deviceLocked", scanBoolean(ext, 705));
            o.put("attestationChallengePresent", scanOctet(ext, 703));
            o.put("parser", "bounded-tag-scan");
            return o;
        } catch (Exception e) {
            o.put("ok", false);
            o.put("code", "ATTESTATION_UNPARSEABLE");
            o.put("detail", e.getClass().getSimpleName() + ": " + e.getMessage());
            return o;
        }
    }

    private static String scanEnum(byte[] b, int tag) {
        for (int i = 0; i + 2 < b.length; i++) {
            int t = ((b[i] & 0xFF) << 8) | (b[i + 1] & 0xFF);
            if (t == tag) {
                int len = b[i + 2] & 0xFF;
                if (len > 0 && i + 3 + len <= b.length) return String.valueOf(b[i + 3] & 0xFF);
            }
        }
        return "ATTESTATION_UNPARSEABLE";
    }

    private static String scanBoolean(byte[] b, int tag) {
        for (int i = 0; i + 2 < b.length; i++) {
            int t = ((b[i] & 0xFF) << 8) | (b[i + 1] & 0xFF);
            if (t == tag) {
                int len = b[i + 2] & 0xFF;
                if (len > 0 && i + 3 + len <= b.length) return String.valueOf((b[i + 3] & 0xFF) != 0);
            }
        }
        return "ATTESTATION_UNPARSEABLE";
    }

    private static String scanOctet(byte[] b, int tag) {
        for (int i = 0; i + 2 < b.length; i++) {
            int t = ((b[i] & 0xFF) << 8) | (b[i + 1] & 0xFF);
            if (t == tag) {
                int len = b[i + 2] & 0xFF;
                if (len > 0 && i + 3 + len <= b.length) return "present";
            }
        }
        return "ATTESTATION_UNPARSEABLE";
    }
}
