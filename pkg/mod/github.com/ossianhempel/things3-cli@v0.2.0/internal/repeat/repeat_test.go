package repeat

import (
	"testing"
	"time"

	"howett.net/plist"
)

func TestBuildUpdateWeeklySchedule(t *testing.T) {
	anchor := time.Date(2026, 1, 6, 15, 0, 0, 0, time.Local)
	spec := Spec{
		Mode:   ModeSchedule,
		Unit:   UnitWeek,
		Every:  2,
		Anchor: anchor,
	}
	update, err := BuildUpdate(spec)
	if err != nil {
		t.Fatalf("BuildUpdate failed: %v", err)
	}

	var decoded map[string]any
	if _, err := plist.Unmarshal(update.RecurrenceRule, &decoded); err != nil {
		t.Fatalf("unmarshal rule: %v", err)
	}
	assertInt(t, decoded["fa"], 2)
	assertInt(t, decoded["fu"], 256)
	assertInt(t, decoded["tp"], 0)
	assertInt(t, decoded["ts"], 0)

	offsets := decoded["of"].([]any)
	if len(offsets) != 1 {
		t.Fatalf("expected 1 offset, got %d", len(offsets))
	}
	offset := offsets[0].(map[string]any)
	assertInt(t, offset["wd"], int(anchor.Weekday()))

	expectedStart := thingsDateValue(anchor.AddDate(0, 0, 1))
	if update.InstanceCreationStartDate != expectedStart {
		t.Fatalf("start date mismatch: got %d want %d", update.InstanceCreationStartDate, expectedStart)
	}
	expectedNext := thingsDateValue(anchor.AddDate(0, 0, 14))
	if update.NextInstanceStartDate == nil || *update.NextInstanceStartDate != expectedNext {
		t.Fatalf("expected next instance for scheduled date")
	}
	if update.SetDeadline {
		t.Fatalf("unexpected deadline flag")
	}
}

func TestBuildUpdateDeadlineOffset(t *testing.T) {
	offset := 3
	spec := Spec{
		Mode:           ModeAfterCompletion,
		Unit:           UnitMonth,
		Every:          1,
		Anchor:         time.Date(2026, 1, 15, 9, 0, 0, 0, time.Local),
		DeadlineOffset: &offset,
	}
	update, err := BuildUpdate(spec)
	if err != nil {
		t.Fatalf("BuildUpdate failed: %v", err)
	}
	if !update.SetDeadline {
		t.Fatalf("expected deadline flag")
	}
	if update.Deadline == nil {
		t.Fatalf("expected deadline sentinel")
	}
	var decoded map[string]any
	if _, err := plist.Unmarshal(update.RecurrenceRule, &decoded); err != nil {
		t.Fatalf("unmarshal rule: %v", err)
	}
	assertInt(t, decoded["ts"], -3)
}

func TestBuildUpdateUntilDate(t *testing.T) {
	end := time.Date(2026, 2, 1, 0, 0, 0, 0, time.Local)
	spec := Spec{
		Mode:    ModeSchedule,
		Unit:    UnitDay,
		Every:   1,
		Anchor:  time.Date(2026, 1, 6, 0, 0, 0, 0, time.Local),
		EndDate: &end,
	}
	update, err := BuildUpdate(spec)
	if err != nil {
		t.Fatalf("BuildUpdate failed: %v", err)
	}
	var decoded map[string]any
	if _, err := plist.Unmarshal(update.RecurrenceRule, &decoded); err != nil {
		t.Fatalf("unmarshal rule: %v", err)
	}
	assertInt(t, decoded["ed"], int(end.Unix()))
}

func assertInt(t *testing.T, value any, expected int) {
	t.Helper()
	switch v := value.(type) {
	case int:
		if v != expected {
			t.Fatalf("expected %d got %d", expected, v)
		}
	case int64:
		if int(v) != expected {
			t.Fatalf("expected %d got %d", expected, v)
		}
	case uint64:
		if int(v) != expected {
			t.Fatalf("expected %d got %d", expected, v)
		}
	case float64:
		if int(v) != expected {
			t.Fatalf("expected %d got %d", expected, int(v))
		}
	default:
		t.Fatalf("unexpected int type %T", value)
	}
}
