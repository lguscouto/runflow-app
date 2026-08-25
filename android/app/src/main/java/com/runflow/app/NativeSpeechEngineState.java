package com.runflow.app;

final class NativeSpeechEngineState<T> {
    private T pending;
    private boolean initializing;
    private boolean initialized;
    private long generation;

    T beginInitialization(T request) {
        generation += 1;
        T superseded = pending;
        pending = request;
        initializing = true;
        initialized = false;
        return superseded;
    }

    T replacePending(T request) {
        T superseded = pending;
        pending = request;
        return superseded;
    }

    T completeInitialization() {
        initializing = false;
        initialized = true;
        return takePending();
    }

    T failInitialization() {
        initializing = false;
        initialized = false;
        return takePending();
    }

    T cancelInitialization() {
        initializing = false;
        initialized = false;
        return takePending();
    }

    T cancelPending() {
        return takePending();
    }

    boolean needsInitialization() {
        return !initialized && !initializing;
    }

    boolean isInitialized() {
        return initialized;
    }

    boolean isInitializing() {
        return initializing;
    }

    long currentGeneration() {
        return generation;
    }

    boolean isCurrentInitialization(long expectedGeneration) {
        return initializing && generation == expectedGeneration;
    }

    void teardown() {
        generation += 1;
        pending = null;
        initializing = false;
        initialized = false;
    }

    private T takePending() {
        T request = pending;
        pending = null;
        return request;
    }
}
