package expo.modules.fretionarysoundpool

import android.media.AudioAttributes
import android.media.SoundPool
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.ConcurrentHashMap

/**
 * Android-only low-latency polyphonic audio playback via SoundPool.
 *
 * Why this exists: every other RN audio backend (expo-av, react-native-sound)
 * wraps MediaPlayer on Android, which is built for media-track playback and
 * silently drops / stutters new playback calls once a few voices overlap or
 * fire in quick succession. SoundPool is Android's purpose-built primitive for
 * short audio samples — up to 16 concurrent voices, low latency, no audio-focus
 * contention. That's what fixes scale-playback stutter on Android.
 *
 * Bass specifics: Fretionary Bass pitch-shifts a handful of recorded samples to
 * every note by changing playback rate. SoundPool.play() takes a rate argument
 * (0.5–2.0) natively, so we expose it — play(name, rate) transposes the sample
 * exactly like the expo-av `rate` path does on iOS.
 *
 * iOS keeps expo-av (AVPlayer handles polyphony + rate fine), so this module is
 * Android-only (see expo-module.config.json).
 *
 * JS API:
 *   - loadFromUri(name, uri): preload a sample from a file URI. Promise
 *     resolves when SoundPool finishes decoding.
 *   - play(name, rate): fire the named sample at a playback rate. Synchronous —
 *     returns true if loaded and dispatched, false otherwise.
 *   - stopAll(): pause every active voice (Stop button / monophonic scale cut).
 *   - unloadAll(): release all SoundPool resources.
 */
class FretionarySoundPoolModule : Module() {
  private var soundPool: SoundPool? = null
  private val nameToSoundId = ConcurrentHashMap<String, Int>()
  private val pendingLoads = ConcurrentHashMap<Int, Promise>()
  private val loadedIds = java.util.Collections.synchronizedSet(mutableSetOf<Int>())

  override fun definition() = ModuleDefinition {
    Name("FretionarySoundPool")

    OnCreate {
      val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
        .build()

      val pool = SoundPool.Builder()
        .setMaxStreams(16)
        .setAudioAttributes(attrs)
        .build()

      pool.setOnLoadCompleteListener { _, soundId, status ->
        if (status == 0) loadedIds.add(soundId)
        val promise = pendingLoads.remove(soundId)
        if (promise != null) {
          if (status == 0) promise.resolve(null)
          else promise.reject("ERR_LOAD", "SoundPool load failed: status=$status", null)
        }
      }

      soundPool = pool
    }

    OnDestroy {
      releaseInternal()
    }

    AsyncFunction("loadFromUri") { name: String, uri: String, promise: Promise ->
      val pool = soundPool ?: run {
        promise.reject("ERR_NOT_READY", "SoundPool not initialized", null)
        return@AsyncFunction
      }
      // Expo Asset.localUri comes through as file:///path/to/file.wav.
      // SoundPool.load(String, int) expects a bare filesystem path.
      val path = if (uri.startsWith("file://")) uri.removePrefix("file://") else uri
      val soundId = try {
        pool.load(path, 1)
      } catch (e: Exception) {
        promise.reject("ERR_LOAD", "Failed to load: ${e.message}", e)
        return@AsyncFunction
      }
      if (soundId == 0) {
        promise.reject("ERR_LOAD", "SoundPool.load returned 0 for $path", null)
        return@AsyncFunction
      }
      nameToSoundId[name] = soundId
      pendingLoads[soundId] = promise
    }

    Function("play") { name: String, rate: Double ->
      val pool = soundPool ?: return@Function false
      val soundId = nameToSoundId[name] ?: return@Function false
      if (!loadedIds.contains(soundId)) return@Function false
      // SoundPool rate is valid in [0.5, 2.0]; clamp defensively. Args:
      // soundID, leftVolume, rightVolume, priority, loop(0=once), rate.
      val r = rate.toFloat().coerceIn(0.5f, 2.0f)
      val streamId = pool.play(soundId, 1.0f, 1.0f, 1, 0, r)
      return@Function streamId != 0
    }

    Function("stopAll") {
      soundPool?.autoPause()
    }

    Function("unloadAll") {
      releaseInternal()
    }
  }

  private fun releaseInternal() {
    soundPool?.release()
    soundPool = null
    nameToSoundId.clear()
    pendingLoads.clear()
    loadedIds.clear()
  }
}
