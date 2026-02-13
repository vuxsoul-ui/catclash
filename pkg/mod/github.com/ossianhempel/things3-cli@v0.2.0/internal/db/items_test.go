package db

import (
	"database/sql"
	"testing"
)

func TestItemByID(t *testing.T) {
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer conn.Close()

	if err := seedTestDB(conn); err != nil {
		t.Fatalf("seed db: %v", err)
	}

	store := &Store{conn: conn, path: ":memory:"}

	item, err := store.ItemByID("P1")
	if err != nil {
		t.Fatalf("item by id: %v", err)
	}
	if item.Type != "project" || item.Title != "Project One" {
		t.Fatalf("unexpected project item: %#v", item)
	}

	item, err = store.ItemByID("TAG1")
	if err != nil {
		t.Fatalf("item by id tag: %v", err)
	}
	if item.Type != "tag" || item.Title != "urgent" {
		t.Fatalf("unexpected tag item: %#v", item)
	}
}

func TestItemsByTitle(t *testing.T) {
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer conn.Close()

	if err := seedTestDB(conn); err != nil {
		t.Fatalf("seed db: %v", err)
	}

	store := &Store{conn: conn, path: ":memory:"}

	items, err := store.ItemsByTitle("Home")
	if err != nil {
		t.Fatalf("items by title: %v", err)
	}
	if len(items) != 1 || items[0].Type != "area" {
		t.Fatalf("unexpected area items: %#v", items)
	}

	items, err = store.ItemsByTitle("Task One")
	if err != nil {
		t.Fatalf("items by title task: %v", err)
	}
	if len(items) != 1 || items[0].Type != "to-do" {
		t.Fatalf("unexpected task items: %#v", items)
	}
}
