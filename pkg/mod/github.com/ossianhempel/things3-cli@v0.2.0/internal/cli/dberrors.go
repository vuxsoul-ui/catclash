package cli

import (
	"fmt"
	"strings"

	"github.com/ossianhempel/things3-cli/internal/db"
)

func formatDBError(err error) error {
	if err == nil {
		return nil
	}
	if err == db.ErrDatabaseNotFound {
		return fmt.Errorf("Error: Things database not found. Set THINGSDB or use --db to specify the path")
	}
	msg := err.Error()
	if strings.HasPrefix(msg, "Error:") {
		return err
	}
	return fmt.Errorf("Error: %s", msg)
}
