window.CODA_DEMO_REPORTS = {
  "D1": {
    "report_type": "CODA_DemoReport",
    "schema_version": 1,
    "demo_id": "D1",
    "title": "Semantic authoring and source location",
    "status": "PASS_OFFLINE_REPORT_BOUND",
    "evidence": {
      "event_asset": "ui.reward.apply",
      "asset_fingerprint": "sha256:6a2ea47e7e1cad12b70342779ea6aeecd0b51eb4e50790e4f2238cf2eb29f6f9",
      "plan_fingerprint": "sha256:33443d65b1eca2c749758712a0a8bbf840bba6556b7da9f965a6b9ae7cccebe8",
      "generated_source_fingerprint": "sha256:0bfc591df2c8a2710557e2861a1f9a321861ea2ef4b8b76bd47c22ae689a7fb1",
      "source_map_entries": 23,
      "source_to_plan_to_generated": true,
      "legacy_launcher_preview_fixture": {
        "file": "visual/d1.png",
        "accepted_as_demo_visual": false
      },
      "replay": {
        "file": "replays/d1-semantic-authoring.replay.json",
        "sha256": "6f2bc2875dda2ffc3fccdf43bc0bfddbfcb9025a28ab5ff13a2472935be1a1eb"
      }
    },
    "boundary": "Does not authorize arbitrary GDScript editing or bypass source ownership."
  },
  "D2": {
    "report_type": "CODA_DemoReport",
    "schema_version": 1,
    "demo_id": "D2",
    "title": "Interruptible behavior runtime",
    "status": "PASS_OFFLINE_AND_GODOT_SMOKE_D2_DISTINCT_STATES_CAPTURED",
    "evidence": {
      "behavior_id": "aibi.companion",
      "plan_fingerprint": "sha256:1fe54fd2682c06d6c58743ee7bf4dbfd6294e96df26928a29c75b527f4d4ea8f",
      "final_state": "listening",
      "cancelled_effects": [
        "speech"
      ],
      "stale_completion_rejections": 1,
      "replay_trace_fingerprint": "sha256:ac4a919f5f4efd0a5ee4a40c03a6e27556f9f600f8b020d96a3f65edf85cbd27",
      "visual_states": [
        {
          "state": "listening",
          "file": "d2-idle.png",
          "generation": 0,
          "sha256": "e49244bed253fbdd5f06b7537d7a56a5cf83f2f35139e557de04434f9e026c61"
        },
        {
          "state": "interrupted_to_listening",
          "file": "d2-interrupted.png",
          "generation": 1,
          "sha256": "ab96876acf8665462d2401af04256d01a8670c4bbee6109157c5cb21b8060dd8"
        }
      ],
      "visual_distinction": "不同 generation、终态记录和 RuntimeObservation；不是只替换标题",
      "replay": {
        "file": "replays/d2-interruptible-behavior.replay.json",
        "sha256": "6a123bb20e5144b09ebbb26d657b7e8c7e077201bd327064a696faee4e2f56bb"
      }
    },
    "boundary": "Does not prove cloud LLM behavior, microphone input, or hardware control."
  },
  "D3": {
    "report_type": "CODA_DemoSmokeReport",
    "schema_version": 1,
    "demo_id": "D3",
    "title": "Skeleton3D intent transition",
    "status": "PASS_RUNTIME_SMOKE_D3_DISTINCT_STATES_CAPTURED_ADAPTER_RECEIPT_VISIBLE",
    "date": "2026-09-22",
    "asset": {
      "source": "/Users/gl/hz/aliyun-terraform/labs/game_toys/aibi/godot/addons/gdquest_gdbot/model/gdbot.glb",
      "copied_to": "demos/d3-skeleton-transition/addons/gdquest_gdbot/model/gdbot.glb",
      "sha256": "cdeca527d5672d0c402362e7b6bdfac35a091096ad504b3bd51d8fa49817025f",
      "license": "CC BY-NC-SA 4.0",
      "license_note": "Prototype and technical validation only; commercial distribution requires a replacement asset or written permission."
    },
    "command": "npm run demo:smoke && godot --headless --path demos/d3-skeleton-transition --script res://tests/d3_skeleton_transition_smoke.gd",
    "checks": [
      "scene loads",
      "real GDBot Skeleton3D is present",
      "Head bone is present",
      "attack intent increments generation and acquires lease",
      "interrupt revokes generation and converges to safe state",
      "head yaw remains within the declared hard limit",
      "late sample from an old generation is rejected without a pose write",
      "external writer is rejected at the ownership barrier without a new generation",
      "external writer rejection closes a terminal receipt without partial write",
      "owner loss blocks new requests and closes one owner_lost terminal receipt",
      "Godot motion Adapter receipt exposes backend, adapter-only authority, barrier, start and terminal fields",
      "real GDBot FaceScreen target is present",
      "happy/default/dizzy expression intents reach the face animation Adapter",
      "external writer blocks expression generation without a partial face write"
    ],
    "result": "D3 Skeleton3D transition smoke passed",
    "plan_consumed_by_runtime": true,
    "plan_source_ref_observed": "/root/0",
    "replay_evidence": "tests/reports/demos/replays/d3-skeleton-transition.replay.json",
    "visual_evidence": [
      "tests/reports/demos/visual/d3-idle.png",
      "tests/reports/demos/visual/d3-interrupted.png"
    ],
    "fixture_sha256": "684c78f3c50f170508e339c41f3bc8acfaa6a46d67adc2528c2370d6240129fc",
    "visual_sha256": {
      "d3-idle.png": "8c0bb7b6207c422094ffb8b64cbd53de6e948993d2af0ed19ec60d3280221b10",
      "d3-interrupted.png": "6a6d7524dddd8415bfb664042508cf2f2c9311f1edb2a97745cb2771a9d5a834"
    },
    "known_warnings": [
      "Imported third-party scenes contain invalid source UIDs; Godot regenerated local import metadata.",
      "A dummy material warning is emitted by the upstream asset and does not fail the smoke test."
    ],
    "adapter_receipt_contract": {
      "backend": "godot.motion@1",
      "execution_authority": "adapter_only",
      "visible_fields": [
        "barrier",
        "start",
        "terminal"
      ],
      "external_writer_status": "rejected_without_partial_write"
    },
    "expression_adapter_contract": {
      "target": "SubViewport/GDbotFace",
      "allowed_expressions": [
        "default",
        "happy",
        "dizzy"
      ],
      "visible_fields": [
        "expression",
        "barrier",
        "terminal",
        "generation"
      ],
      "external_writer_status": "rejected_without_new_generation"
    },
    "remaining_for_stage_acceptance": [
      "Calibrate C1-T technical thresholds and add full replay/observation correlation; this smoke does not prove naturalness.",
      "Keep the generated plan step and runtime receipt versioned when the launcher grows a full source-to-plan UI action."
    ]
  },
  "D4": {
    "report_type": "CODA_DemoReport",
    "schema_version": 1,
    "demo_id": "D4",
    "title": "Multi-fidelity planning cascade",
    "status": "PASS_OFFLINE_REPORT_BOUND",
    "evidence": {
      "cascade": [
        "kinematic/admissibility",
        "reduced/local dynamics",
        "top-k or uncertainty high-fidelity validation"
      ],
      "candidates": [
        {
          "id": "kinematic-1",
          "tier": "kinematic",
          "hard_safe": true,
          "decision": "execute",
          "state_error": 0.18,
          "work_units": 12
        },
        {
          "id": "reduced-1",
          "tier": "reduced",
          "hard_safe": true,
          "decision": "execute",
          "state_error": 0.07,
          "work_units": 44
        },
        {
          "id": "high-1",
          "tier": "high",
          "hard_safe": true,
          "decision": "execute",
          "state_error": 0.02,
          "work_units": 160
        },
        {
          "id": "kinematic-dangerous",
          "tier": "kinematic",
          "hard_safe": false,
          "decision": "reject",
          "state_error": 0.04,
          "work_units": 15
        }
      ],
      "selected": {
        "id": "kinematic-1",
        "tier": "kinematic",
        "hard_safe": true,
        "decision": "execute",
        "state_error": 0.18,
        "work_units": 12
      },
      "dangerous_low_fidelity_candidate": "kinematic-dangerous",
      "decision_flip_policy": "hard safety rejection wins over state-error average",
      "legacy_launcher_preview_fixture": {
        "file": "visual/d4.png",
        "accepted_as_demo_visual": false
      },
      "replay": {
        "file": "replays/d4-multifidelity-planning.replay.json",
        "sha256": "18a7a421ec4d108ffb9501a97ab2bccdbc90918727807eb4f24f31ea7a79d47f"
      }
    },
    "boundary": "Does not claim highest fidelity is always required or universally best."
  },
  "D5": {
    "report_type": "CODA_DemoReport",
    "schema_version": 1,
    "demo_id": "D5",
    "title": "Anytime and safety boundary",
    "status": "PASS_OFFLINE_REPORT_BOUND",
    "evidence": {
      "budget_sweep": [
        {
          "budget": 20,
          "candidate": "kinematic-1",
          "certified": true,
          "outcome": "execute"
        },
        {
          "budget": 60,
          "candidate": "reduced-1",
          "certified": true,
          "outcome": "execute"
        },
        {
          "budget": 180,
          "candidate": "high-1",
          "certified": true,
          "outcome": "execute"
        },
        {
          "budget": 8,
          "candidate": null,
          "certified": false,
          "outcome": "fallback"
        }
      ],
      "invariant": "budget exhaustion never returns an uncertified candidate",
      "hard_gates": [
        "schema/resource/numerical validity",
        "safety/viability",
        "deadline reserve"
      ],
      "pareto_scope": "certified candidates only",
      "legacy_launcher_preview_fixture": {
        "file": "visual/d5.png",
        "accepted_as_demo_visual": false
      },
      "replay": {
        "file": "replays/d5-anytime-safety-boundary.replay.json",
        "sha256": "35e6ed50c8b79d5fb43dfb55255c55acdfd9fefc6427f0f89cacd40e41f72b91"
      }
    },
    "boundary": "Does not prove success when no certified candidate exists."
  },
  "D6": {
    "report_type": "CODA_DemoReport",
    "schema_version": 1,
    "demo_id": "D6",
    "title": "Failure and boundary gallery",
    "status": "PASS_OFFLINE_REPORT_BOUND",
    "evidence": {
      "cases": [
        {
          "id": "unknown-capability",
          "result": "reject",
          "diagnostics": [
            "CAPABILITY_VERSION_MISMATCH",
            "CAPABILITY_VERSION_MISMATCH"
          ]
        },
        {
          "id": "missing-motion-safety-contract",
          "result": "reject",
          "diagnostics": [
            "MISSING_MOTION_INTENT_CONTRACT",
            "MISSING_MOTION_INTENT_CONTRACT",
            "MISSING_MOTION_INTENT_CONTRACT",
            "MISSING_MOTION_INTENT_CONTRACT"
          ]
        },
        {
          "id": "uncertified-anytime",
          "result": "fallback",
          "diagnostics": [
            "NO_CERTIFIED_CANDIDATE"
          ]
        }
      ],
      "fail_closed": true,
      "legacy_launcher_preview_fixture": {
        "file": "visual/d6.png",
        "accepted_as_demo_visual": false
      },
      "replay": {
        "file": "replays/d6-failure-boundary-gallery.replay.json",
        "sha256": "7e5c47668c022ae4c3a5cd604e34d6f2f1450bda0e3237dd684934d29f6ecdde"
      }
    },
    "boundary": "Does not turn failure into a silent quality downgrade."
  }
};
