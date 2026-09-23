#include <fcntl.h>
#include <malloc/malloc.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

static _Atomic unsigned long long g_malloc_calls = 0;
static _Atomic unsigned long long g_calloc_calls = 0;
static _Atomic unsigned long long g_realloc_calls = 0;
static _Atomic unsigned long long g_free_calls = 0;

static malloc_zone_t *zone(void) {
    return malloc_default_zone();
}

void *coda_malloc(size_t size) {
    atomic_fetch_add_explicit(&g_malloc_calls, 1, memory_order_relaxed);
    return malloc_zone_malloc(zone(), size);
}

void *coda_calloc(size_t count, size_t size) {
    atomic_fetch_add_explicit(&g_calloc_calls, 1, memory_order_relaxed);
    return malloc_zone_calloc(zone(), count, size);
}

void *coda_realloc(void *pointer, size_t size) {
    atomic_fetch_add_explicit(&g_realloc_calls, 1, memory_order_relaxed);
    return malloc_zone_realloc(zone(), pointer, size);
}

void coda_free(void *pointer) {
    atomic_fetch_add_explicit(&g_free_calls, 1, memory_order_relaxed);
    malloc_zone_free(zone(), pointer);
}

static void write_report(void) {
    const char *path = getenv("CODA_MALLOC_REPORT");
    if (path == NULL || *path == '\0') path = getenv("CODA_MALLOC_REPORT");
    if (path == NULL || *path == '\0') return;
    int fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) return;
    char buffer[256];
    int length = snprintf(buffer, sizeof(buffer),
        "{\"malloc_calls\":%llu,\"calloc_calls\":%llu,\"realloc_calls\":%llu,\"free_calls\":%llu}\n",
        atomic_load_explicit(&g_malloc_calls, memory_order_relaxed),
        atomic_load_explicit(&g_calloc_calls, memory_order_relaxed),
        atomic_load_explicit(&g_realloc_calls, memory_order_relaxed),
        atomic_load_explicit(&g_free_calls, memory_order_relaxed));
    if (length > 0) write(fd, buffer, (size_t)length);
    close(fd);
}

__attribute__((destructor)) static void coda_malloc_report(void) { write_report(); }

__attribute__((used)) static struct {
    const void *replacement;
    const void *replacee;
} coda_interposers[] __attribute__((section("__DATA,__interpose"))) = {
    {(const void *)coda_malloc, (const void *)malloc},
    {(const void *)coda_calloc, (const void *)calloc},
    {(const void *)coda_realloc, (const void *)realloc},
    {(const void *)coda_free, (const void *)free},
};
