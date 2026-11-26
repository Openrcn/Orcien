package nosana

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// TODO fnd reliable way or wait for official nosana support for availability in /markets endpoint. Until then, we query the Solana RPC directly to get the queue length for each market.
func (c *Client) getAvailableNodes() map[string]int {
	const (
		rpcURL    = "https://rpc.ironforge.network/mainnet?apiKey=01J4RYMAWZC65B6CND9DTZZ5BK"
		programID = "nosJhNRqr2bc9g1nfGDcXXTXvYUmxD4cVwy2pMWhrYM"
	)

	payload, _ := json.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "getProgramAccounts",
		"params": []any{
			programID,
			map[string]any{
				"encoding": "base64",
				"filters": []any{
					map[string]any{"memcmp": map[string]any{
						"offset": 0, "bytes": "afwFqcydEve", "encoding": "base58",
					}},
				},
			},
		},
	})

	resp, err := http.Post(rpcURL, "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)

	var rpc struct {
		Result []struct {
			Pubkey  string `json:"pubkey"`
			Account struct {
				Data []string `json:"data"`
			} `json:"account"`
		} `json:"result"`
	}
	if json.Unmarshal(raw, &rpc) != nil {
		return nil
	}

	out := make(map[string]int)
	for _, item := range rpc.Result {
		if len(item.Account.Data) == 0 {
			continue
		}
		buf, err := base64.StdEncoding.DecodeString(item.Account.Data[0])
		if err != nil || len(buf) < 152 {
			continue
		}
		if buf[146] != 1 { // NODE_QUEUE only
			continue
		}
		qLen := int(binary.LittleEndian.Uint32(buf[147:151]))
		out[item.Pubkey] = qLen // 0 is valid — means market exists but no nodes queued
	}
	return out
}

func (c *Client) GetInstanceTypes() (any, error) {
	b, err := c.request("GET", "/markets", nil)
	if err != nil {
		return nil, err
	}

	var markets []map[string]any
	if err := json.Unmarshal(b, &markets); err != nil {
		return nil, err
	}

	availability := c.getAvailableNodes() // nil if RPC fails — frontend shows nothing

	filtered := make([]map[string]any, 0, len(markets))
	for _, market := range markets {
		if marketType, ok := market["type"].(string); ok {
			if strings.EqualFold(marketType, "COMMUNITY") || strings.EqualFold(marketType, "OTHER") {
				continue
			}
			market["tag"] = marketType
		}

		// Drop markets that don't advertise VRAM and the "(Reserved)"
		// placeholder market Nosana publishes with a bogus 999GB VRAM.
		if marketVRAMGB(market) <= 0 || isReservedMarket(market) {
			continue
		}

		// Map availability: only set if we got a valid RPC response
		if availability != nil {
			addr, _ := market["address"].(string)
			if addr == "" {
				addr, _ = market["id"].(string)
			}
			if addr != "" {
				qLen, found := availability[addr]
				if found {
					market["available"] = qLen
				}
				// if not found in map → market not a NODE_QUEUE → don't set field
			}
		}

		filtered = append(filtered, market)
	}
	return filtered, nil
}

// marketVRAMGB returns the market's advertised VRAM in GB, parsed from its
// metadata list, e.g. [{"key":"vram","value":"24GB"}]. It returns 0 when the
// market doesn't advertise VRAM.
func marketVRAMGB(market map[string]any) float64 {
	metadata, ok := market["metadata"].([]any)
	if !ok {
		return 0
	}
	for _, entry := range metadata {
		item, ok := entry.(map[string]any)
		if !ok {
			continue
		}
		key, _ := item["key"].(string)
		if !strings.EqualFold(key, "vram") {
			continue
		}
		switch value := item["value"].(type) {
		case float64:
			return value
		case string:
			return leadingNumber(value)
		}
	}
	return 0
}

// isReservedMarket reports whether the market is a placeholder for reserved
// capacity, e.g. Nosana's "(Reserved)" market.
func isReservedMarket(market map[string]any) bool {
	name, _ := market["name"].(string)
	if strings.Contains(strings.ToLower(name), "reserved") {
		return true
	}
	slug, _ := market["slug"].(string)
	return strings.Contains(strings.ToLower(slug), "reserved")
}

// leadingNumber parses the first numeric run in a string like "24GB".
func leadingNumber(s string) float64 {
	start := -1
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			start = i
			break
		}
	}
	if start == -1 {
		return 0
	}
	end := start
	for end < len(s) && ((s[end] >= '0' && s[end] <= '9') || s[end] == '.') {
		end++
	}
	v, _ := strconv.ParseFloat(s[start:end], 64)
	return v
}
