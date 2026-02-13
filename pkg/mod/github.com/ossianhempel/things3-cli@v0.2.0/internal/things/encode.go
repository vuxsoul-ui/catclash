package things

import "strings"

// URLEncode encodes a string using the Things URL scheme rules.
func URLEncode(input string) string {
	var b strings.Builder
	b.Grow(len(input))
	for i := 0; i < len(input); i++ {
		c := input[i]
		switch {
		case c >= 'a' && c <= 'z':
			b.WriteByte(c)
		case c >= 'A' && c <= 'Z':
			b.WriteByte(c)
		case c >= '0' && c <= '9':
			b.WriteByte(c)
		case c == '.' || c == '~' || c == '_' || c == '-':
			b.WriteByte(c)
		default:
			b.WriteString("%")
			hex := "0123456789ABCDEF"
			b.WriteByte(hex[c>>4])
			b.WriteByte(hex[c&0x0F])
		}
	}
	return b.String()
}
