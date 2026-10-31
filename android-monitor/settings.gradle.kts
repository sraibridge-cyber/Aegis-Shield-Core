pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "aegis-monitor"
include(":app")
include(":csslabs-sdk")
// The SDK lives in the repository root, next to the monitor page.
project(":csslabs-sdk").projectDir = file("../csslabs-sdk")
