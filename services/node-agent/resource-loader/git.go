package main

import (
	"context"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/transport"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"

	"orcn/services/node-agent/resources"
)

const (
	loaderGitTimeout = 10 * time.Minute
)

func installGit(ctx context.Context, resource resources.Resource, progress progressFunc) error {
	urlStr, ok := resource.Config["url"].(string)
	if !ok || strings.TrimSpace(urlStr) == "" {
		return fmt.Errorf("git resource %q requires config.url", resource.ID)
	}

	parsed, err := url.Parse(urlStr)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https" && parsed.Scheme != "ssh") {
		return fmt.Errorf("resource %q has an invalid git URL", resource.ID)
	}

	branch := "main"
	if rev, ok := resource.Config["revision"].(string); ok && rev != "" {
		branch = rev
	}

	token, _ := resource.Config["token"].(string)

	destination := resource.Destination
	if destination == "" || !filepath.IsAbs(destination) || filepath.Clean(destination) == "/" {
		return fmt.Errorf("resource %q has an invalid destination", resource.ID)
	}

	requestCtx, cancel := context.WithTimeout(ctx, loaderGitTimeout)
	defer cancel()

	if progress != nil {
		progress(0, -1)
	}

	var auth transport.AuthMethod
	if token != "" {
		auth = &githttp.BasicAuth{
			Username: "token",
			Password: token,
		}
	}

	repo, err := git.PlainCloneContext(requestCtx, destination, false, &git.CloneOptions{
		URL:           urlStr,
		ReferenceName: plumbing.ReferenceName("refs/heads/" + branch),
		SingleBranch:  true,
		Depth:         1,
		Auth:          auth,
		Progress:      &gitProgress{progress: progress},
	})
	if err != nil {
		if strings.Contains(err.Error(), "reference not found") || strings.Contains(err.Error(), "could not find remote reference") {
			repo, err = git.PlainCloneContext(requestCtx, destination, false, &git.CloneOptions{
				URL:           urlStr,
				ReferenceName: plumbing.ReferenceName("refs/tags/" + branch),
				SingleBranch:  true,
				Depth:         1,
				Auth:          auth,
				Progress:      &gitProgress{progress: progress},
			})
			if err != nil {
				return fmt.Errorf("clone git resource %q: %w", resource.ID, err)
			}
		} else {
			return fmt.Errorf("clone git resource %q: %w", resource.ID, err)
		}
	}

	worktree, err := repo.Worktree()
	if err != nil {
		return fmt.Errorf("get worktree for git resource %q: %w", resource.ID, err)
	}

	head, err := repo.Head()
	if err != nil {
		return fmt.Errorf("get head for git resource %q: %w", resource.ID, err)
	}

	if progress != nil {
		progress(-1, -1)
	}

	_ = worktree
	_ = head

	return nil
}

type gitProgress struct {
	progress progressFunc
	total    int64
	done     int64
}

func (p *gitProgress) Write(data []byte) (int, error) {
	n := len(data)
	p.done += int64(n)
	if p.progress != nil {
		p.progress(p.done, p.total)
	}
	return n, nil
}

func (p *gitProgress) SetTotal(total int64) {
	p.total = total
}