package expo.modules.hostservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HostServiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HostService")

    // Starts the foreground service. Android only allows this while the app is visible, which is
    // the case when the teacher taps "Host on this phone".
    Function("start") { text: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("No Android context available")
      val intent = Intent(context, HostForegroundService::class.java).putExtra(HostForegroundService.EXTRA_TEXT, text)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
      null
    }

    Function("stop") {
      val context = appContext.reactContext
      if (context != null) {
        context.stopService(Intent(context, HostForegroundService::class.java))
      }
      null
    }
  }
}
