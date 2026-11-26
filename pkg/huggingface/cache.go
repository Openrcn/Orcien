package huggingface

import (
	"sync"
	"time"
)

type searchCacheEntry struct {
	models    []Model
	fetchedAt time.Time
}

type bytesCacheEntry struct {
	data      []byte
	fetchedAt time.Time
}

type cache struct {
	mu sync.RWMutex

	searchTTL        time.Duration
	bytesTTL         time.Duration
	maxSearchEntries int
	maxBytesEntries  int
	search           map[string]searchCacheEntry
	bytes            map[string]bytesCacheEntry
}

func newCache(searchTTL, bytesTTL time.Duration, maxSearchEntries, maxBytesEntries int) *cache {
	return &cache{
		searchTTL:        searchTTL,
		bytesTTL:         bytesTTL,
		maxSearchEntries: maxSearchEntries,
		maxBytesEntries:  maxBytesEntries,
		search:           make(map[string]searchCacheEntry),
		bytes:            make(map[string]bytesCacheEntry),
	}
}

func (c *cache) getSearch(key string) ([]Model, bool) {
	if c.searchTTL <= 0 {
		return nil, false
	}
	c.mu.RLock()
	entry, ok := c.search[key]
	c.mu.RUnlock()
	if !ok || time.Since(entry.fetchedAt) >= c.searchTTL {
		return nil, false
	}
	out := make([]Model, len(entry.models))
	for index, model := range entry.models {
		out[index] = model.Clone()
	}
	return out, true
}

func (c *cache) putSearch(key string, models []Model) {
	if c.searchTTL <= 0 {
		return
	}
	copied := make([]Model, len(models))
	for index, model := range models {
		copied[index] = model.Clone()
	}

	c.mu.Lock()
	if c.maxSearchEntries > 0 && len(c.search) >= c.maxSearchEntries {
		c.search = make(map[string]searchCacheEntry)
	}
	c.search[key] = searchCacheEntry{models: copied, fetchedAt: time.Now()}
	c.mu.Unlock()
}

func (c *cache) getBytes(key string) ([]byte, bool) {
	if c.bytesTTL <= 0 {
		return nil, false
	}
	c.mu.RLock()
	entry, ok := c.bytes[key]
	c.mu.RUnlock()
	if !ok || time.Since(entry.fetchedAt) >= c.bytesTTL {
		return nil, false
	}
	return append([]byte(nil), entry.data...), true
}

func (c *cache) putBytes(key string, data []byte) {
	if c.bytesTTL <= 0 {
		return
	}
	copied := append([]byte(nil), data...)

	c.mu.Lock()
	if c.maxBytesEntries > 0 && len(c.bytes) >= c.maxBytesEntries {
		c.bytes = make(map[string]bytesCacheEntry)
	}
	c.bytes[key] = bytesCacheEntry{data: copied, fetchedAt: time.Now()}
	c.mu.Unlock()
}

func (c *cache) flush() {
	c.mu.Lock()
	c.search = make(map[string]searchCacheEntry)
	c.bytes = make(map[string]bytesCacheEntry)
	c.mu.Unlock()
}
