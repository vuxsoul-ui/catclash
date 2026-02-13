package cli

import "testing"

func TestFormatErrorUnknownCommand(t *testing.T) {
	msg := FormatError(errString("unknown command \"foo\" for \"things\""))
	if msg != "Error: Invalid command `things foo'" {
		t.Fatalf("unexpected message: %q", msg)
	}
}

func TestFormatErrorUnknownFlag(t *testing.T) {
	msg := FormatError(errString("unknown flag: --nope"))
	if msg != "Error: Invalid option `--nope'" {
		t.Fatalf("unexpected message: %q", msg)
	}
}

func TestFormatErrorUnknownShorthand(t *testing.T) {
	msg := FormatError(errString("unknown shorthand flag: 'x' in -x"))
	if msg != "Error: Invalid option `-x'" {
		t.Fatalf("unexpected message: %q", msg)
	}
}

func TestFormatErrorAlreadyFormatted(t *testing.T) {
	msg := FormatError(errString("Error: Must specify --id=ID or query"))
	if msg != "Error: Must specify --id=ID or query" {
		t.Fatalf("unexpected message: %q", msg)
	}
}

type errString string

func (e errString) Error() string { return string(e) }
