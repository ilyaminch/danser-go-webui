// A CLI-only entry point for the web launcher; the upstream desktop launcher stays available.
package main

import (
	"github.com/wieku/danser-go/app"
	"github.com/wieku/danser-go/framework/env"
)

func main() {
	env.Init("danser")
	app.Run()
}
