package db

import (
	"fmt"
	"time"
)

func formatThingsDate(value int64) string {
	if value <= 0 {
		return ""
	}
	year := int(value >> 16)
	month := int((value >> 12) & 0x0f)
	day := int((value >> 7) & 0x1f)
	if year <= 0 || month <= 0 || day <= 0 {
		return ""
	}
	return fmt.Sprintf("%04d-%02d-%02d", year, month, day)
}

func formatTimestamp(value float64) string {
	if value <= 0 {
		return ""
	}
	sec := int64(value)
	nsec := int64((value - float64(sec)) * 1e9)
	t := time.Unix(sec, nsec).In(time.Local)
	return t.Format("2006-01-02 15:04:05")
}

func startLabel(start int) string {
	switch start {
	case 0:
		return "Inbox"
	case 1:
		return "Anytime"
	case 2:
		return "Someday"
	default:
		return ""
	}
}
