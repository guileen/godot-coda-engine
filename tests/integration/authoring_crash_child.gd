extends SceneTree

const STORE := preload("res://addons/gseos/core/asset_store.gd")

var store := STORE.new()

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() < 2:
		push_error("authoring crash child expects mode and fixture name")
		quit(2)
		return
	var mode := args[0]
	var case_name := args[1]
	var source_path := "res://.gseos/" + case_name + ".coda"
	var asset_path := "res://.gseos/" + case_name + ".gse.json"
	if mode == "seed":
		var source := "event ui.crash.owned [id: ui.crash.owned]:\n  let score = 1 # @node_id=stable.score\n"
		_write(source_path, source)
		var parsed := _parse(source_path)
		var seeded := store.save_text_owned_asset(asset_path, source_path, source, parsed, -1, "")
		if not seeded.saved: _fail("seed transaction failed")
		quit(0)
		return
	if mode == "update":
		var loaded := store.load_asset(asset_path)
		if not loaded.receipt.ok or not loaded.ownership_receipt.ok: _fail("could not load seeded source")
		var original := FileAccess.get_file_as_string(source_path)
		var updated := original.replace("score = 1", "score = 2")
		var candidate_path := source_path + ".candidate"
		_write(candidate_path, updated)
		var parsed := _parse(candidate_path)
		store.save_text_owned_asset(asset_path, source_path, updated, parsed, int(loaded.ownership.owner_revision), String(loaded.ownership.source.fingerprint))
		_fail("configured crash point was not reached")
		return
	if mode == "recover":
		if args.size() < 3: _fail("recover mode expects old/new state")
		var expected := args[2]
		var recovery := store.recover_transaction(asset_path)
		var loaded := store.load_asset(asset_path)
		var expected_value := 1 if expected == "old" else 2
		var expected_source := "score = %d" % expected_value
		if not recovery.ok or not loaded.receipt.ok or not loaded.ownership_receipt.ok:
			_fail("fresh process could not recover and read the file set")
			return
		if loaded.asset.root[0].params.value != expected_value or loaded.ownership.owner_revision != (0 if expected == "old" else 1) or not FileAccess.get_file_as_string(source_path).contains(expected_source):
			_fail("recovery did not restore one consistent %s file set" % expected)
		_cleanup(case_name)
		print("authoring crash recovery passed: " + case_name)
		quit(0)
		return
	_fail("unsupported child mode: " + mode)

func _parse(path: String) -> Dictionary:
	var output: Array[String] = []
	var cli := ProjectSettings.globalize_path("res://packages/local-core/src/gseos-cli.js")
	var exit_code := OS.execute("node", [cli, "parse", ProjectSettings.globalize_path(path)], output, true)
	if exit_code != 0: _fail("GSE parse failed for " + path)
	var parsed = JSON.parse_string("\n".join(output))
	if not parsed is Dictionary or not parsed.get("receipt", {}).get("ok", false): _fail("GSE parser returned invalid fixture")
	return parsed.asset

func _write(path: String, content: String) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null: _fail("could not write " + path)
	file.store_string(content)
	file.close()

func _cleanup(case_name: String) -> void:
	var stem := "res://.gseos/" + case_name
	for suffix in [".coda", ".coda.candidate", ".gse.json", ".gse.json.ownership.json", ".coda.tmp", ".gse.json.tmp", ".gse.json.ownership.json.tmp", ".coda.bak", ".gse.json.bak", ".gse.json.ownership.json.bak", ".gse.json.transaction.json", ".gse.json.transaction.json.tmp", ".gse.json.transaction.commit.json", ".gse.json.transaction.commit.json.tmp"]:
		var path := ProjectSettings.globalize_path(stem + suffix)
		if FileAccess.file_exists(path): DirAccess.remove_absolute(path)

func _fail(message: String) -> void:
	push_error(message)
	quit(1)
