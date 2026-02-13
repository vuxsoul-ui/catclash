package repeat

import (
	"fmt"
	"strings"
	"time"

	"github.com/ossianhempel/things3-cli/internal/db"
	"howett.net/plist"
)

// Mode describes the repeat scheduling strategy.
type Mode int

const (
	ModeAfterCompletion Mode = iota
	ModeSchedule
)

// Unit describes the repeat interval unit.
type Unit int

const (
	UnitDay Unit = iota
	UnitWeek
	UnitMonth
	UnitYear
)

// Spec defines the recurrence configuration for a repeating item.
type Spec struct {
	Mode           Mode
	Unit           Unit
	Every          int
	Anchor         time.Time
	EndDate        *time.Time
	DeadlineOffset *int
}

// ParseMode parses a repeat mode string.
func ParseMode(input string) (Mode, error) {
	switch strings.ToLower(strings.TrimSpace(input)) {
	case "", "after-completion", "after", "completion", "complete":
		return ModeAfterCompletion, nil
	case "schedule", "scheduled", "fixed", "fixed-schedule":
		return ModeSchedule, nil
	default:
		return ModeAfterCompletion, fmt.Errorf("invalid repeat mode %q", input)
	}
}

// ParseUnit parses a repeat unit string.
func ParseUnit(input string) (Unit, error) {
	switch strings.ToLower(strings.TrimSpace(input)) {
	case "day", "daily", "d":
		return UnitDay, nil
	case "week", "weekly", "w":
		return UnitWeek, nil
	case "month", "monthly", "m":
		return UnitMonth, nil
	case "year", "yearly", "y":
		return UnitYear, nil
	default:
		return UnitDay, fmt.Errorf("invalid repeat unit %q", input)
	}
}

// BuildUpdate builds a database update for a repeating item.
func BuildUpdate(spec Spec) (db.RepeatUpdate, error) {
	if spec.Every <= 0 {
		return db.RepeatUpdate{}, fmt.Errorf("repeat interval must be >= 1")
	}
	anchor := normalizeDate(spec.Anchor)
	endDate := farFutureTime()
	if spec.EndDate != nil {
		endDate = normalizeDate(*spec.EndDate)
		if endDate.Before(anchor) {
			return db.RepeatUpdate{}, fmt.Errorf("repeat end date must be on or after the start date")
		}
	}
	offsets, err := offsetsFor(anchor, spec.Unit)
	if err != nil {
		return db.RepeatUpdate{}, err
	}

	modeValue := 1
	if spec.Mode == ModeSchedule {
		modeValue = 0
	}

	ts := 0
	setDeadline := false
	var deadline *int
	if spec.DeadlineOffset != nil {
		if *spec.DeadlineOffset < 0 {
			return db.RepeatUpdate{}, fmt.Errorf("repeat deadline offset must be >= 0")
		}
		ts = -1 * (*spec.DeadlineOffset)
		setDeadline = true
		sentinel := thingsDateValue(time.Date(4001, 1, 1, 0, 0, 0, 0, time.Local))
		deadline = &sentinel
	}

	rule := map[string]any{
		"ed":  float64(endDate.Unix()),
		"fa":  spec.Every,
		"fu":  unitValue(spec.Unit),
		"ia":  float64(anchor.Unix()),
		"of":  offsets,
		"rc":  0,
		"rrv": 4,
		"sr":  float64(anchor.Unix()),
		"tp":  modeValue,
		"ts":  ts,
	}

	encoded, err := plist.Marshal(rule, plist.XMLFormat)
	if err != nil {
		return db.RepeatUpdate{}, fmt.Errorf("encode recurrence rule: %w", err)
	}

	startDate := anchor.AddDate(0, 0, 1)
	start := thingsDateValue(startDate)
	var next *int
	if spec.Mode == ModeSchedule {
		nextDate, err := nextScheduleDate(anchor, startDate, spec.Unit, spec.Every)
		if err != nil {
			return db.RepeatUpdate{}, err
		}
		value := thingsDateValue(nextDate)
		next = &value
	}

	return db.RepeatUpdate{
		RecurrenceRule:            encoded,
		InstanceCreationStartDate: start,
		InstanceCreationPaused:    0,
		InstanceCreationCount:     0,
		AfterCompletionReference:  nil,
		NextInstanceStartDate:     next,
		Deadline:                  deadline,
		SetDeadline:               setDeadline,
	}, nil
}

func normalizeDate(t time.Time) time.Time {
	if t.IsZero() {
		t = time.Now()
	}
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func nextScheduleDate(anchor, start time.Time, unit Unit, every int) (time.Time, error) {
	if every <= 0 {
		return time.Time{}, fmt.Errorf("repeat interval must be >= 1")
	}
	anchor = normalizeDate(anchor)
	start = normalizeDate(start)
	if start.Before(anchor) {
		start = anchor
	}
	switch unit {
	case UnitDay:
		diff := daysBetween(anchor, start)
		steps := diff / every
		if diff%every != 0 {
			steps++
		}
		return anchor.AddDate(0, 0, steps*every), nil
	case UnitWeek:
		daysUntil := (int(anchor.Weekday()) - int(start.Weekday()) + 7) % 7
		candidate := start.AddDate(0, 0, daysUntil)
		weeksBetween := daysBetween(anchor, candidate) / 7
		remainder := weeksBetween % every
		if remainder != 0 {
			candidate = candidate.AddDate(0, 0, (every-remainder)*7)
		}
		return candidate, nil
	case UnitMonth:
		return nextMonthly(anchor, start, every), nil
	case UnitYear:
		return nextYearly(anchor, start, every), nil
	default:
		return time.Time{}, fmt.Errorf("unsupported repeat unit")
	}
}

func nextMonthly(anchor, start time.Time, every int) time.Time {
	anchor = normalizeDate(anchor)
	start = normalizeDate(start)
	if start.Before(anchor) {
		start = anchor
	}
	diff := monthsBetween(anchor, start)
	steps := diff / every
	candidate := addMonths(anchor, steps*every)
	for candidate.Before(start) {
		candidate = addMonths(candidate, every)
	}
	return candidate
}

func nextYearly(anchor, start time.Time, every int) time.Time {
	anchor = normalizeDate(anchor)
	start = normalizeDate(start)
	if start.Before(anchor) {
		start = anchor
	}
	diff := start.Year() - anchor.Year()
	steps := diff / every
	candidate := addYears(anchor, steps*every)
	for candidate.Before(start) {
		candidate = addYears(candidate, every)
	}
	return candidate
}

func daysBetween(a, b time.Time) int {
	ua := time.Date(a.Year(), a.Month(), a.Day(), 0, 0, 0, 0, time.UTC)
	ub := time.Date(b.Year(), b.Month(), b.Day(), 0, 0, 0, 0, time.UTC)
	return int(ub.Sub(ua).Hours() / 24)
}

func monthsBetween(a, b time.Time) int {
	return (b.Year()-a.Year())*12 + int(b.Month()) - int(a.Month())
}

func addMonths(anchor time.Time, months int) time.Time {
	year := anchor.Year()
	month := int(anchor.Month()) + months
	year += (month - 1) / 12
	month = (month-1)%12 + 1
	return dateWithDay(year, time.Month(month), anchor.Day(), anchor.Location())
}

func addYears(anchor time.Time, years int) time.Time {
	return dateWithDay(anchor.Year()+years, anchor.Month(), anchor.Day(), anchor.Location())
}

func dateWithDay(year int, month time.Month, day int, loc *time.Location) time.Time {
	if loc == nil {
		loc = time.Local
	}
	maxDay := daysInMonth(year, month, loc)
	if day > maxDay {
		day = maxDay
	}
	if day < 1 {
		day = 1
	}
	return time.Date(year, month, day, 0, 0, 0, 0, loc)
}

func daysInMonth(year int, month time.Month, loc *time.Location) int {
	if loc == nil {
		loc = time.Local
	}
	return time.Date(year, month+1, 0, 0, 0, 0, 0, loc).Day()
}

func offsetsFor(anchor time.Time, unit Unit) ([]map[string]int, error) {
	switch unit {
	case UnitDay:
		return []map[string]int{{"dy": 0}}, nil
	case UnitWeek:
		return []map[string]int{{"wd": int(anchor.Weekday())}}, nil
	case UnitMonth:
		return []map[string]int{{"dy": anchor.Day() - 1}}, nil
	case UnitYear:
		return []map[string]int{{"dy": anchor.Day() - 1, "mo": int(anchor.Month()) - 1}}, nil
	default:
		return nil, fmt.Errorf("unsupported repeat unit")
	}
}

func unitValue(unit Unit) int {
	switch unit {
	case UnitDay:
		return 16
	case UnitWeek:
		return 256
	case UnitMonth:
		return 8
	case UnitYear:
		return 4
	default:
		return 16
	}
}

func thingsDateValue(t time.Time) int {
	date := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	return date.Year()<<16 | int(date.Month())<<12 | date.Day()<<7
}

func farFutureEpochSeconds() float64 {
	return float64(time.Date(4001, 1, 1, 0, 0, 0, 0, time.Local).Unix())
}

func farFutureTime() time.Time {
	return time.Date(4001, 1, 1, 0, 0, 0, 0, time.Local)
}
