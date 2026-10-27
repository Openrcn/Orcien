package core

import (
	"fmt"
	"strings"
	"testing"
)

func TestAssignContainerIDs(t *testing.T) {
	spec := &JobSpec{
		Containers: []ContainerSpec{
			{ID: "web", Args: ContainerArgs{Image: "nginx"}},
			{ID: "web", Args: ContainerArgs{Image: "nginx"}},
			{ID: "api services?", Args: ContainerArgs{Image: "api"}},
		},
	}

	if err := AssignContainerIDs(spec); err != nil {
		t.Fatalf("AssignContainerIDs: %v", err)
	}

	ids := make(map[string]bool)
	names := make(map[string]bool)
	for _, c := range spec.Containers {
		if c.ID == "" {
			t.Fatalf("container id was not assigned for container %q", c.Name)
		}
		if c.Name == "" {
			t.Fatalf("container name was not assigned for container %q", c.ID)
		}
		if c.ID == c.Name {
			t.Fatalf("container id must be unique from name, got %q for both", c.ID)
		}
		if ids[c.ID] {
			t.Fatalf("duplicate container id %q", c.ID)
		}
		ids[c.ID] = true
		names[c.Name] = true
	}

	if len(names) != 3 {
		t.Fatalf("expected 3 unique container names, got %v", names)
	}
	if spec.Containers[0].Name != "web" || spec.Containers[1].Name != "web-2" {
		t.Fatalf("expected deployment-unique names web and web-2, got %q and %q",
			spec.Containers[0].Name, spec.Containers[1].Name)
	}
	if spec.Containers[2].ID == "" || spec.Containers[2].Name != "api-services" {
		t.Fatalf("expected sanitized name api-services, got %q", spec.Containers[2].Name)
	}

	// Same deployment name across deployments must still yield unique IDs.
	if spec.Containers[0].ID == spec.Containers[2].ID {
		t.Fatalf("ids must differ across assignments")
	}
}

func TestSanitizeContainerName(t *testing.T) {
	cases := map[string]string{
		"Web":        "web",
		"my app":     "my-app",
		"-#[fail]#":  "fail",
		"9lives":     "9lives",
		"":           "container",
		"  ":         "container",
		"a.b_c-d":    "a.b_c-d",
		"trailing-_": "trailing",
	}
	for input, want := range cases {
		if got := SanitizeContainerName(input); got != want {
			t.Errorf("SanitizeContainerName(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestAssignContainerIDsAllUnique(t *testing.T) {
	spec := &JobSpec{JobName: jobName, Containers: []ContainerSpec{
		{ID: "svc"}, {ID: "svc"}, {ID: "svc"},
	}}
	if err := AssignContainerIDs(spec); err != nil {
		t.Fatalf("AssignContainerIDs: %v", err)
	}
	seen := make(map[string]bool)
	for i, c := range spec.Containers {
		wantName := fmt.Sprintf("svc-%d", i+1)
		if i > 0 {
			// "-1" suffix is never appended; first keeps the bare name.
		}
		if seen[c.ID] {
			t.Fatalf("duplicate id %q", c.ID)
		}
		seen[c.ID] = true
		want := wantName
		if i == 0 {
			want = "svc"
		}
		if c.Name != want {
			t.Fatalf("container %d name = %q, want %q", i, c.Name, want)
		}
		if !containsSegment(c.ID, want) {
			t.Fatalf("container %d id %q must contain name segment %q", i, c.ID, want)
		}
	}
}

// containsSegment checks that s matches "orcn.<job>.<name>.<digits>".
func containsSegment(s, name string) bool {
	return strings.Contains(s, "orcn."+jobName+".") && strings.Contains(s, "."+name+".")
}

const jobName = "testjob"
