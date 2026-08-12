# Demo script

Twelve minutes. Tested end to end.

## Before you start

Say once, plainly: *"The pipeline, the gates and the tool controls are real
code. The agent reasoning is mocked so this runs without touching anything."*

Saying it up front costs five seconds. Being caught later costs the room.

## 1 — The shape (1 min)

Open on **Who does what**. Three numbers in the header: 18 agents, 9
approvals, 12 tools. Point out that agents propose, people decide.

## 2 — Set up the run (2 min)

Run A1, A2, A3. Note A3's line: *"This agent is rules-based, not AI. Policy
decisions must be explainable to an auditor."*

Stop at **G0**. Nothing has been read yet. Approve.

## 3 — The valuable part (3 min)

Run A4 through A6. On A6, read one extracted rule aloud with its citation —
`POLPREM.cbl lines 412-438`.

**Then do this:** untick the citation requirement and re-run A6. The log
turns red: *"These rules cannot be verified or defended."* Open G1 — it now
blocks. Re-tick, re-run, approve.

That single toggle is the whole governance argument.

## 4 — Where the money goes (2 min)

Run A7 through A11, approve G1 and G2. On A9 pick "one application with
internal walls" and note the caution: more pieces is not automatically
better.

## 5 — Proving it (3 min)

Run A12 to A17. On **A17, clear all three tolerances**, then open **G5**:

> *"3 differences are still unexplained. Approving now would put wrong
> answers in front of customers."*

The button still works. Say why: the gate informs the human, it does not
replace them.

Go back, tick all three tolerances, re-run, approve.

## 6 — The security answer (1 min)

Switch to **Tool gateway**. Twelve servers grouped by access level. Most are
read-only. Deployment sits behind an approval.

If someone asks whether an agent could go rogue: an agent can only reach
servers it declared, the check happens at call time, and denied attempts are
logged.

## Questions you will get

**"Is this running against real COBOL?"** No. Pipeline and controls are real,
agent reasoning is mocked. Live mode calls real models; real parsers are the
next build.

**"What did it cost?"** Header shows spend. Mock is free. A real 50 KLOC
pilot is roughly $200 with hosted models on the four agents that need them.

**"Could we run it entirely in-house?"** Yes. Every component is open source;
local models via vLLM or Ollama. Expect roughly 70–80% rule-extraction recall
against 90%+ from a frontier model.

**"How long to a real pilot?"** Ingestion and parsers are the long pole —
10 to 14 weeks for one narrow estate. Not the agents.
