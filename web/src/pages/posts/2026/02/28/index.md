---
layout: '@/layouts/Doc.astro'
title: '⏱️ Comparing Launchers on Aurora'
date: 2026-02-28
description: 'Benchmarking and comparing the performance of different launchers on Aurora at ALCF: `torchrun` vs. `ezpz launch`'
---

## `torchrun`

## `ezpz`

- Got through 190 steps in ~49s before I hit the kill switch

    ```bash
    #[aurora_frameworks-2025.3.1](torchtitan-aurora_frameworks-2025.3.1)[38s]
    #[02/28/26,14:29:02][x4020c0s0b0n0][/f/A/f/p/s/torchtitan][ezpz][?]
    ;  ezpz launch -n 2 -np 2 -nh 1 -- python3 -m torchtitan.experiments.ezpz.train --module ezpz.agpt --config ezpz_agpt_debugmodel


    [2026-02-28 14:29:11,095723][I][ezpz/launch:421:launch] ----[🍋 ezpz.launch][started][2026-02-28-142911]----
    [2026-02-28 14:29:11,101835][I][ezpz/launch:66:_log_json_log_file] Logs available at: /lus/flare/projects/AuroraGPT/foremans/projects/saforem2/torchtitan/logs/torchtitan.experiments.ezpz.train/2026-02-28-142910-rank0.jsonl
    [2026-02-28 14:29:13,015798][I][ezpz/launch:442:launch] Job ID: 8359703
    [2026-02-28 14:29:13,016610][I][ezpz/launch:443:launch] nodelist: ['x4020c0s0b0n0', 'x4020c0s1b0n0']
    [2026-02-28 14:29:13,017029][I][ezpz/launch:444:launch] hostfile: /var/spool/pbs/aux/8359703.aurora-pbs-0001.hostmgmt.cm.aurora.alcf.anl.gov
    [2026-02-28 14:29:13,017705][I][ezpz/pbs:273:get_pbs_launch_cmd] ⚠️ Using [2/24] GPUs [1 hosts] x [2 GPU/host]
    [2026-02-28 14:29:13,018247][W][ezpz/pbs:279:get_pbs_launch_cmd] [🚧 WARNING] Using only [2/24] available GPUs!!
    [2026-02-28 14:29:13,019057][I][ezpz/launch:391:build_executable] Building command to execute by piecing together:
    [2026-02-28 14:29:13,019475][I][ezpz/launch:392:build_executable] (1.) launch_cmd: mpiexec --envall --np=2 --ppn=2 --hostfile=/var/spool/pbs/aux/8359703.aurora-pbs-0001.hostmgmt.cm.aurora.alcf.anl.gov --no-vni --cpu-bind=verbose,list:2-4:10-12:18-20:26-28:34-36:42-44:54-56:62-64:70-72:78-80:86-88:94-96
    [2026-02-28 14:29:13,020124][I][ezpz/launch:393:build_executable] (2.) cmd_to_launch: python3 -m torchtitan.experiments.ezpz.train --module ezpz.agpt --config ezpz_agpt_debugmodel
    [2026-02-28 14:29:13,020780][I][ezpz/launch:460:launch] Took: 2.54 seconds to build command.
    [2026-02-28 14:29:13,021143][I][ezpz/launch:463:launch] Executing:
    mpiexec
    --envall
    --np=2
    --ppn=2
    --hostfile=/var/spool/pbs/aux/8359703.aurora-pbs-0001.hostmgmt.cm.aurora.alcf.anl.gov
    --no-vni
    --cpu-bind=verbose,list:2-4:10-12:18-20:26-28:34-36:42-44:54-56:62-64:70-72:78-80:86-88:94-96
    python3
    -m
    torchtitan.experiments.ezpz.train
    --module
    ezpz.agpt
    --config
    ezpz_agpt_debugmodel
    [2026-02-28 14:29:13,022468][I][ezpz/launch:242:get_aurora_filters] Filtering for Aurora-specific messages. To view list of filters, run with EZPZ_LOG_LEVEL=DEBUG
    [2026-02-28 14:29:13,022990][I][ezpz/launch:470:launch] Execution started @ 2026-02-28-142913...
    [2026-02-28 14:29:13,023408][I][ezpz/launch:160:run_command] Caught 24 filters
    [2026-02-28 14:29:13,023770][I][ezpz/launch:161:run_command] Running command:
    mpiexec --envall --np=2 --ppn=2 --hostfile=/var/spool/pbs/aux/8359703.aurora-pbs-0001.hostmgmt.cm.aurora.alcf.anl.gov --no-vni --cpu-bind=verbose,list:2-4:10-12:18-20:26-28:34-36:42-44:54-56:62-64:70-72:78-80:86-88:94-96 python3 -m torchtitan.experiments.ezpz.train --module ezpz.agpt --config ezpz_agpt_debugmodel
    cpubind:list x4020c0s0b0n0 pid 46486 rank 0 0: mask 0x1c
    cpubind:list x4020c0s0b0n0 pid 46487 rank 1 1: mask 0x1c00
    Using [2 / 24] available "xpu" devices !!
    [num_nodes_from_hostfile=2]vs.[1] (wsa=2 // gpus_per_node=12)
    [titan] 2026-02-28 14:29:17,872 - root - INFO - torchtitan version: 0.0.0+unknown (0.0.0 means __version__ is not defined correctly).
    [2026-02-28 14:29:20,883348][W][distributed/utils:298:init_distributed] torch.distributed is already initialized. Skipping init_distributed. The provided comm_config and other settings will not take effect.
    [2026-02-28 14:29:20,885358][I][distributed/parallel_dims:131:build_mesh] Building device mesh with parallelism: pp=1, dp_replicate=1, dp_shard=2, cp=1, tp=1, ep=1, etp=1
    [2026-02-28 14:29:20,891663][I][distributed/parallel_dims:184:build_mesh] Successfully created meshes with active dimensions: ['batch', 'loss', 'fsdp', 'efsdp']
    [2026-02-28 14:29:20,892713][I][tools/utils:73:collect] [GC] Initial GC collection took 0.00 seconds
    2026:02:28-14:29:20:46486 |CCL_WARN| value of CCL_LOG_LEVEL changed to be error (default:warn)
    [2026-02-28 14:29:21,155062][I][components/tokenizer:117:_load_tokenizer_from_path] Loading tokenizer from tokenizer.json
    [2026-02-28 14:29:21,163560][I][hf_datasets/text_datasets:66:_validate_dataset] Preparing c4_test dataset from tests/assets/c4_test
    [2026-02-28 14:29:21,687267][I][ft/trainer:116:__init__] Building ezpz.agpt debugmodel with {
    "dim": 256,
    "n_layers": 6,
    "vocab_size": 2048,
    "norm_eps": 1e-05,
    "rope": {
        "dim": 16,
        "max_seq_len": 2048,
        "theta": 500000,
        "backend": "complex",
        "scaling": "llama",
        "scaling_factor": 8.0,
        "low_freq_factor": 1.0,
        "high_freq_factor": 4.0,
        "original_max_position_embeddings": 8192,
        "rope_factor": 1.0,
        "beta_fast": 32.0,
        "beta_slow": 1.0,
        "original_seq_len": 4096,
        "mscale": 0.0
    },
    "layer": {
        "norm_eps": 1e-05,
        "attention": {
        "n_heads": 16,
        "attn_backend": "sdpa",
        "attn_mask_type": "causal",
        "n_kv_heads": null,
        "head_dim": null,
        "qk_norm": false,
        "norm_eps": 1e-05,
        "bias": false,
        "use_rope": true,
        "rope_backend": "complex"
        },
        "feed_forward": {
        "hidden_dim": 768,
        "bias": false
        },
        "moe": null,
        "depth_init": true
    }
    }
    [2026-02-28 14:29:21,701601][I][components/metrics:98:build_device_memory_monitor] XPU capacity: Intel(R) Data Center GPU Max 1550 with 63.98GiB memory
    [2026-02-28 14:29:21,746679][I][ft/trainer:153:__init__] Model ezpz.agpt debugmodel size: 6,163,712 total parameters
    [2026-02-28 14:29:21,747548][I][distributed/activation_checkpoint:249:apply_ac] Applied selective activation checkpointing to the model
    [2026-02-28 14:29:21,763901][I][agpt/parallelize:126:parallelize_llama] Applied FSDP to the model
    [2026-02-28 14:29:22,109145][I][ft/trainer:268:__init__] Peak FLOPS used for computing MFU: 2.982e+14
    [2026-02-28 14:29:22,109976][I][ft/trainer:270:__init__] XPU memory usage for model: 0.02GiB(0.02%)
    [2026-02-28 14:29:22,110889][W][protocols/state_dict_adapter:96:__init__] model.safetensors.index.json not found at hf_assets_path: ./tests/assets/tokenizer/model.safetensors.index.json.                     Defaulting to saving a single safetensors file if checkpoint is saved in HF format
    [2026-02-28 14:29:22,113986][I][distributed/utils:248:maybe_enable_amp] Mixed precision training is handled by fully_shard
    [2026-02-28 14:29:22,114507][I][ft/trainer:364:__init__] Trainer is initialized with local batch size 8, global batch size 16, gradient accumulation steps 1, sequence length 2048, total steps 10000 (warmup 200)
    [2026-02-28 14:29:22,115081][I][ft/trainer:523:train] Training starts at step 1
    [2026-02-28 14:29:23,662786][I][components/metrics:515:log] step:  1  loss:  8.13834  grad_norm:  1.3149  memory:  8.29GiB(12.96%)  tps: 8,550  tflops: 0.61  mfu: 0.21%
    [2026-02-28 14:29:23,663958][I][distributed/utils:379:set_pg_timeouts] Synchronizing and adjusting timeout for all ProcessGroups to 0:01:40
    /lus/flare/projects/AuroraGPT/foremans/projects/saforem2/torchtitan/torchtitan/distributed/utils.py:395: UserWarning: Set timeout is now only supported for either nccl or gloo.
    torch.distributed.distributed_c10d._set_pg_timeout(timeout, group)
    /lus/flare/projects/AuroraGPT/foremans/projects/saforem2/torchtitan/torchtitan/distributed/utils.py:395: UserWarning: Set timeout is now only supported for either nccl or gloo.
    torch.distributed.distributed_c10d._set_pg_timeout(timeout, group)
    [2026-02-28 14:29:25,055428][I][components/metrics:515:log] step: 10  loss:  8.02783  grad_norm:  1.3883  memory:  8.30GiB(12.97%)  tps: 105,974  tflops: 7.59  mfu: 2.54%
    [2026-02-28 14:29:26,584187][I][components/metrics:515:log] step: 20  loss:  7.58133  grad_norm:  1.5400  memory:  8.30GiB(12.97%)  tps: 107,242  tflops: 7.68  mfu: 2.57%
    [2026-02-28 14:29:28,116840][I][components/metrics:515:log] step: 30  loss:  6.33049  grad_norm:  2.3625  memory:  8.30GiB(12.97%)  tps: 106,966  tflops: 7.66  mfu: 2.57%
    [2026-02-28 14:29:29,637456][I][components/metrics:515:log] step: 40  loss:  4.70528  grad_norm:  2.4628  memory:  8.30GiB(12.97%)  tps: 107,811  tflops: 7.72  mfu: 2.59%
    [2026-02-28 14:29:31,026418][I][tools/utils:73:collect] [GC] Performing periodic GC collection took 0.01 seconds
    [2026-02-28 14:29:31,177200][I][components/metrics:515:log] step: 50  loss:  3.81425  grad_norm:  1.8086  memory:  8.30GiB(12.97%)  tps: 106,472  tflops: 7.62  mfu: 2.56%
    [2026-02-28 14:29:32,701515][I][components/metrics:515:log] step: 60  loss:  3.30735  grad_norm:  0.9320  memory:  8.30GiB(12.97%)  tps: 107,548  tflops: 7.70  mfu: 2.58%
    [2026-02-28 14:29:34,235587][I][components/metrics:515:log] step: 70  loss:  3.01942  grad_norm:  0.5519  memory:  8.30GiB(12.97%)  tps: 106,864  tflops: 7.65  mfu: 2.57%
    [2026-02-28 14:29:35,795588][I][components/metrics:515:log] step: 80  loss:  2.96857  grad_norm:  0.3655  memory:  8.30GiB(12.97%)  tps: 105,089  tflops: 7.52  mfu: 2.52%
    [2026-02-28 14:29:37,355094][I][components/metrics:515:log] step: 90  loss:  2.83759  grad_norm:  0.4565  memory:  8.30GiB(12.97%)  tps: 105,120  tflops: 7.53  mfu: 2.52%
    [2026-02-28 14:29:38,736377][I][tools/utils:73:collect] [GC] Performing periodic GC collection took 0.01 seconds
    [2026-02-28 14:29:38,890440][I][components/metrics:515:log] step: 100  loss:  2.83428  grad_norm:  0.4375  memory:  8.30GiB(12.97%)  tps: 106,776  tflops: 7.64  mfu: 2.56%
    [2026-02-28 14:29:40,417778][I][components/metrics:515:log] step: 110  loss:  2.79788  grad_norm:  0.3403  memory:  8.30GiB(12.97%)  tps: 107,334  tflops: 7.68  mfu: 2.58%
    [2026-02-28 14:29:40,424763][W][hf_datasets/text_datasets:138:__iter__] Dataset c4_test is being re-looped
    [2026-02-28 14:29:41,939798][I][components/metrics:515:log] step: 120  loss:  2.93548  grad_norm:  0.4606  memory:  8.30GiB(12.97%)  tps: 107,710  tflops: 7.71  mfu: 2.59%
    [2026-02-28 14:29:43,461210][I][components/metrics:515:log] step: 130  loss:  2.82229  grad_norm:  0.3851  memory:  8.30GiB(12.97%)  tps: 107,753  tflops: 7.71  mfu: 2.59%
    [2026-02-28 14:29:44,983914][I][components/metrics:515:log] step: 140  loss:  2.71684  grad_norm:  0.3783  memory:  8.30GiB(12.97%)  tps: 107,665  tflops: 7.71  mfu: 2.58%
    [2026-02-28 14:29:46,352718][I][tools/utils:73:collect] [GC] Performing periodic GC collection took 0.01 seconds
    [2026-02-28 14:29:46,504471][I][components/metrics:515:log] step: 150  loss:  2.84511  grad_norm:  0.4313  memory:  8.30GiB(12.97%)  tps: 107,815  tflops: 7.72  mfu: 2.59%
    [2026-02-28 14:29:48,029670][I][components/metrics:515:log] step: 160  loss:  2.79779  grad_norm:  0.4913  memory:  8.30GiB(12.97%)  tps: 107,485  tflops: 7.69  mfu: 2.58%
    [2026-02-28 14:29:49,554232][I][components/metrics:515:log] step: 170  loss:  2.78644  grad_norm:  0.6984  memory:  8.30GiB(12.97%)  tps: 107,531  tflops: 7.70  mfu: 2.58%
    [2026-02-28 14:29:51,071728][I][components/metrics:515:log] step: 180  loss:  2.73290  grad_norm:  0.4409  memory:  8.30GiB(12.97%)  tps: 108,033  tflops: 7.73  mfu: 2.59%
    [2026-02-28 14:29:52,595778][I][components/metrics:515:log] step: 190  loss:  2.71296  grad_norm:  0.3844  memory:  8.30GiB(12.97%)  tps: 107,576  tflops: 7.70  mfu: 2.58%
    ^C
    Aborted!
    [1]    46313 exit 1     ezpz launch -n 2 -np 2 -nh 1 -- python3 -m torchtitan.experiments.ezpz.train
    took: 49s
    ```
