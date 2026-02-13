package grizzly

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"
)

type CallbackResult struct {
	Success bool
	Values  url.Values
}

type CallbackServer struct {
	BaseURL    string
	SuccessURL string
	ErrorURL   string
	results    chan CallbackResult
	server     *http.Server
	listener   net.Listener
	once       sync.Once
}

func StartCallbackServer() (*CallbackServer, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}

	baseURL := fmt.Sprintf("http://%s", ln.Addr().String())
	server := &CallbackServer{
		BaseURL:    baseURL,
		SuccessURL: baseURL + "/success",
		ErrorURL:   baseURL + "/error",
		results:    make(chan CallbackResult, 1),
		listener:   ln,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/success", func(w http.ResponseWriter, r *http.Request) {
		server.finish(true, r.URL.Query())
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/error", func(w http.ResponseWriter, r *http.Request) {
		server.finish(false, r.URL.Query())
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	server.server = &http.Server{Handler: mux}

	go func() {
		_ = server.server.Serve(ln)
	}()

	return server, nil
}

func (c *CallbackServer) finish(success bool, values url.Values) {
	c.once.Do(func() {
		c.results <- CallbackResult{Success: success, Values: values}
	})
}

func (c *CallbackServer) Wait(ctx context.Context) (CallbackResult, error) {
	select {
	case res := <-c.results:
		_ = c.Shutdown()
		return res, nil
	case <-ctx.Done():
		_ = c.Shutdown()
		return CallbackResult{}, ctx.Err()
	}
}

func (c *CallbackServer) Shutdown() error {
	if c.server == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return c.server.Shutdown(ctx)
}
