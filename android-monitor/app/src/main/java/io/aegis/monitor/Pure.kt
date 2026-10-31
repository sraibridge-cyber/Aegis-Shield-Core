package io.aegis.monitor

import java.security.MessageDigest

// Pure helpers with no Android calls, so they run in plain JVM unit tests.
object SignalParsers {
    // Settings.Secure lists enabled components as "pkg/cls:pkg2/cls2".
    fun parseComponentList(raw: String?): List<String> {
        if (raw.isNullOrBlank()) return emptyList()
        return raw.split(':').map { it.trim() }.filter { it.isNotEmpty() }.distinct()
    }

    fun packageOf(component: String): String = component.substringBefore('/')

    // Certificates installed by the user have aliases starting with "user:".
    // System certificates start with "system:".
    fun userCaAliases(aliases: List<String>): List<String> = aliases.filter { it.startsWith("user:") }

    fun sha256Hex(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
}

// Minimal JSON writer. It handles only the types the signal snapshot uses.
object Json {
    fun encode(value: Any?): String {
        val sb = StringBuilder()
        write(sb, value)
        return sb.toString()
    }

    private fun write(sb: StringBuilder, v: Any?) {
        when (v) {
            null -> sb.append("null")
            is Boolean -> sb.append(if (v) "true" else "false")
            is Int -> sb.append(v.toString())
            is Long -> sb.append(v.toString())
            is Double -> sb.append(if (v.isFinite()) v.toString() else "null")
            is String -> writeString(sb, v)
            is Map<*, *> -> {
                sb.append('{')
                var first = true
                for ((k, x) in v) {
                    if (!first) sb.append(',')
                    first = false
                    writeString(sb, k.toString())
                    sb.append(':')
                    write(sb, x)
                }
                sb.append('}')
            }
            is Iterable<*> -> {
                sb.append('[')
                var first = true
                for (x in v) {
                    if (!first) sb.append(',')
                    first = false
                    write(sb, x)
                }
                sb.append(']')
            }
            else -> writeString(sb, v.toString())
        }
    }

    private fun writeString(sb: StringBuilder, s: String) {
        sb.append('"')
        for (c in s) {
            when (c) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                else -> if (c < ' ') sb.append("\\u%04x".format(c.code)) else sb.append(c)
            }
        }
        sb.append('"')
    }
}
