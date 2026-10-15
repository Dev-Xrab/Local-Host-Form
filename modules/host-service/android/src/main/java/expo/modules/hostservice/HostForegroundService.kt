package expo.modules.hostservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * An ongoing notification that marks the app as doing user-visible work, so Android keeps its
 * process (and the JavaScript server running inside it) alive while the app is in the background.
 * The server itself runs in the app's JS runtime; this service only holds the process up.
 */
class HostForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: "Students on your Wi-Fi can join your sessions."
    val notification = buildNotification(text)
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    // If Android has to kill the process under memory pressure, ask it to restart the service.
    return START_STICKY
  }

  private fun buildNotification(text: String): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "Hosting", NotificationManager.IMPORTANCE_LOW)
      channel.description = "Shown while this phone is hosting Self Host Form sessions"
      manager.createNotificationChannel(channel)
    }

    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL_ID) else Notification.Builder(this)
    return builder
      .setContentTitle("Self Host Form is hosting")
      .setContentText(text)
      .setSmallIcon(R.drawable.ic_host_notification)
      .setOngoing(true)
      .setContentIntent(pending)
      .build()
  }

  companion object {
    const val EXTRA_TEXT = "text"
    private const val CHANNEL_ID = "self_host_form_hosting"
    private const val NOTIFICATION_ID = 7412
  }
}
