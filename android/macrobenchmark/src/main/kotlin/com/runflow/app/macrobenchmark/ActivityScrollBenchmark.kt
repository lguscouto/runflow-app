package com.runflow.app.macrobenchmark

import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@LargeTest
@RunWith(AndroidJUnit4::class)
class ActivityScrollBenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun scrollSyntheticThousandActivityFixture() = benchmarkRule.measureRepeated(
        packageName = BenchmarkJourneys.TARGET_PACKAGE,
        metrics = listOf(FrameTimingMetric()),
        iterations = BenchmarkJourneys.DEFAULT_ITERATIONS,
        setupBlock = {
            pressHome()
        },
    ) {
        startActivityAndWait()
        val device = device()
        check(BenchmarkJourneys.waitForTargetApp(device)) {
            "RunFlow benchmark target did not become visible"
        }
        BenchmarkJourneys.traceSyntheticJourney("activity-scroll-1000") {
            check(BenchmarkJourneys.openActivities(device)) {
                "RunFlow activities semantic selector was not found"
            }
            check(BenchmarkJourneys.scrollSyntheticActivities(device)) {
                "RunFlow activity list has no semantic scroll container"
            }
        }
    }

    private fun device(): UiDevice =
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
}
