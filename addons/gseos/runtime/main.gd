extends Node

## Minimal runtime entrypoint for the exported CODA pack.
## Events are started by the host game through EventRegistry; the pack itself
## must remain free of editor, parser, and EventAsset-loading code.
func _ready() -> void:
	set_process(false)
