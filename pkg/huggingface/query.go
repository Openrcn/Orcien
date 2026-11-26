package huggingface

import (
	"net/url"
	"strconv"
	"strings"
)

// SearchQuery is a fluent builder for Hugging Face Hub model searches.
//
// Example:
//
//	models, err := huggingface.Default().Search(ctx,
//		huggingface.NewSearchQuery("qwen").
//			PipelineTag("text-generation").
//			AddFilter("sglang").
//			SortBy("downloads").
//			Descending().
//			Limit(100).
//			ExpandFields("config", "safetensors"),
//	)
type SearchQuery struct {
	search         string
	pipelineTags   []string
	filters        []string
	excludeFilters []string
	author         string
	sort           string
	direction      string
	limit          int
	expand         []string
}

// NewSearchQuery starts a model search. An empty term lists models instead of
// matching a term.
func NewSearchQuery(term string) *SearchQuery {
	return &SearchQuery{search: strings.TrimSpace(term)}
}

// PipelineTag restricts the search to a single Hugging Face pipeline tag.
// Repeated calls add more tags; Search performs one request per tag and merges
// the results.
func (q *SearchQuery) PipelineTag(tag string) *SearchQuery {
	tag = strings.TrimSpace(tag)
	if tag != "" {
		q.pipelineTags = append(q.pipelineTags, tag)
	}
	return q
}

// PipelineTags adds several pipeline tags at once.
func (q *SearchQuery) PipelineTags(tags ...string) *SearchQuery {
	for _, tag := range tags {
		q.PipelineTag(tag)
	}
	return q
}

// AddFilter adds a Hub tag filter (for example "sglang", "vllm", "gguf").
// The Hub accepts repeated filter parameters and ANDs them together.
func (q *SearchQuery) AddFilter(filter string) *SearchQuery {
	filter = strings.TrimSpace(filter)
	if filter != "" {
		q.filters = append(q.filters, filter)
	}
	return q
}

// Filters adds several Hub tag filters at once.
func (q *SearchQuery) Filters(filters ...string) *SearchQuery {
	for _, filter := range filters {
		q.AddFilter(filter)
	}
	return q
}

// AddExcludeFilter adds a negative Hub tag filter.
func (q *SearchQuery) AddExcludeFilter(filter string) *SearchQuery {
	filter = strings.TrimSpace(filter)
	if filter != "" {
		q.excludeFilters = append(q.excludeFilters, filter)
	}
	return q
}

// Author restricts results to a single Hub author/organisation.
func (q *SearchQuery) Author(author string) *SearchQuery {
	q.author = strings.TrimSpace(author)
	return q
}

// SortBy selects the sort field, for example "downloads", "likes" or
// "lastModified".
func (q *SearchQuery) SortBy(field string) *SearchQuery {
	q.sort = strings.TrimSpace(field)
	return q
}

// Descending sets the sort direction to descending.
func (q *SearchQuery) Descending() *SearchQuery {
	q.direction = "-1"
	return q
}

// Ascending sets the sort direction to ascending.
func (q *SearchQuery) Ascending() *SearchQuery {
	q.direction = "1"
	return q
}

// Limit caps the number of returned models.
func (q *SearchQuery) Limit(limit int) *SearchQuery {
	q.limit = limit
	return q
}

// ExpandFields asks the Hub to include extra fields such as "config" or
// "safetensors" in the response.
func (q *SearchQuery) ExpandFields(fields ...string) *SearchQuery {
	for _, field := range fields {
		field = strings.TrimSpace(field)
		if field != "" {
			q.expand = append(q.expand, field)
		}
	}
	return q
}

// Values returns the query string parameters for the Hub API.
func (q *SearchQuery) Values() url.Values {
	values := url.Values{}
	if q.search != "" {
		values.Set("search", q.search)
	}
	if len(q.pipelineTags) == 1 {
		values.Set("pipeline_tag", q.pipelineTags[0])
	}
	for _, filter := range q.filters {
		values.Add("filter", filter)
	}
	for _, filter := range q.excludeFilters {
		values.Add("exclude", filter)
	}
	if q.author != "" {
		values.Set("author", q.author)
	}
	if q.sort != "" {
		values.Set("sort", q.sort)
	}
	if q.direction != "" {
		values.Set("direction", q.direction)
	}
	if q.limit > 0 {
		values.Set("limit", strconv.Itoa(q.limit))
	}
	for _, field := range q.expand {
		values.Add("expand", field)
	}
	return values
}

// URL returns the full Hub search URL for the given API base URL.
func (q *SearchQuery) URL(apiBaseURL string) string {
	return strings.TrimRight(apiBaseURL, "/") + "/models?" + q.Values().Encode()
}

// CacheKey returns a stable key for caching this query.
func (q *SearchQuery) CacheKey() string {
	return q.Values().Encode()
}

// forPipeline returns a copy of the query pinned to one pipeline tag.
func (q *SearchQuery) forPipeline(tag string) *SearchQuery {
	copied := *q
	copied.pipelineTags = nil
	if tag != "" {
		copied.pipelineTags = []string{tag}
	}
	copied.filters = append([]string(nil), q.filters...)
	copied.excludeFilters = append([]string(nil), q.excludeFilters...)
	copied.expand = append([]string(nil), q.expand...)
	return &copied
}

func (q *SearchQuery) pipelineTagList() []string {
	if len(q.pipelineTags) == 0 {
		return []string{""}
	}
	return q.pipelineTags
}
