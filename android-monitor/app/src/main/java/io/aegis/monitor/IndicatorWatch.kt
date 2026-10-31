package io.aegis.monitor

import android.content.Context
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.media.AudioRecordingConfiguration
import android.os.Handler
import android.os.Looper

// Counts how many audio recordings are active and how many cameras are not
// free to this app, using Android's own availability callbacks. These report
// THAT something is recording or busy. They do not say which app, and they
// never see the audio or video itself. This app does not use the microphone
// or the camera.
//
// The callbacks only run while the app process is alive, so a snapshot shows
// the state since the app was opened, not the state over the whole day.
class IndicatorWatch(context: Context) {
    private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val cameras = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    private val lock = Any()
    private val unavailable = HashSet<String>()
    @Volatile private var micClients: Int? = null
    private var started = false

    fun start() {
        if (started) return
        started = true
        val handler = Handler(Looper.getMainLooper())
        micClients = try {
            audio.activeRecordingConfigurations.size
        } catch (e: Exception) {
            null
        }
        audio.registerAudioRecordingCallback(object : AudioManager.AudioRecordingCallback() {
            override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>) {
                micClients = configs.size
            }
        }, handler)
        cameras.registerAvailabilityCallback(object : CameraManager.AvailabilityCallback() {
            override fun onCameraAvailable(cameraId: String) {
                synchronized(lock) { unavailable.remove(cameraId) }
            }

            override fun onCameraUnavailable(cameraId: String) {
                synchronized(lock) { unavailable.add(cameraId) }
            }
        }, handler)
    }

    fun snapshot(): Map<String, Any?> = mapOf(
        "microphoneRecordingClients" to micClients,
        "camerasInUse" to synchronized(lock) { unavailable.size },
    )
}
