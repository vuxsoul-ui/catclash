package grizzly

import (
	"context"
	"net/url"
	"testing"
	"time"
)

func TestCallbackServerFinish(t *testing.T) {
	server, err := StartCallbackServer()
	if err != nil {
		t.Fatalf("StartCallbackServer: %v", err)
	}

	values := url.Values{}
	values.Set("identifier", "XYZ")
	server.finish(true, values)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	res, err := server.Wait(ctx)
	if err != nil {
		t.Fatalf("Wait: %v", err)
	}
	if !res.Success {
		t.Fatalf("expected success")
	}
	if res.Values.Get("identifier") != "XYZ" {
		t.Fatalf("identifier = %q", res.Values.Get("identifier"))
	}
}
