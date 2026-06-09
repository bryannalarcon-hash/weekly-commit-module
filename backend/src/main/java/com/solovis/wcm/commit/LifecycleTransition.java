// LifecycleTransition — the legal-transition table for the weekly-commit FSM (KTD3).
// Each constant is one allowed (from -> to) edge; LifecycleService consults isLegal(...) before
// applying guards. Anything not enumerated here is illegal by construction.
package com.solovis.wcm.commit;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public enum LifecycleTransition {
  DRAFT_TO_LOCKED(LifecycleState.DRAFT, LifecycleState.LOCKED),
  LOCKED_TO_RECONCILING(LifecycleState.LOCKED, LifecycleState.RECONCILING),
  RECONCILING_TO_RECONCILED(LifecycleState.RECONCILING, LifecycleState.RECONCILED),
  RECONCILED_TO_CARRY_FORWARD(LifecycleState.RECONCILED, LifecycleState.CARRY_FORWARD),
  // Escape hatch (KTD/U9): carry forward directly from LOCKED without reconciling.
  LOCKED_TO_CARRY_FORWARD(LifecycleState.LOCKED, LifecycleState.CARRY_FORWARD);

  private final LifecycleState from;
  private final LifecycleState to;

  LifecycleTransition(LifecycleState from, LifecycleState to) {
    this.from = from;
    this.to = to;
  }

  public LifecycleState from() {
    return from;
  }

  public LifecycleState to() {
    return to;
  }

  /** Legal target states keyed by source state — the canonical FSM adjacency. */
  private static final Map<LifecycleState, Set<LifecycleState>> LEGAL = buildLegalMap();

  private static Map<LifecycleState, Set<LifecycleState>> buildLegalMap() {
    Map<LifecycleState, Set<LifecycleState>> map = new java.util.EnumMap<>(LifecycleState.class);
    for (LifecycleState state : LifecycleState.values()) {
      map.put(state, EnumSet.noneOf(LifecycleState.class));
    }
    for (LifecycleTransition t : values()) {
      map.get(t.from).add(t.to);
    }
    return map;
  }

  /** True iff {@code from -> to} is an enumerated legal edge (guards checked separately). */
  public static boolean isLegal(LifecycleState from, LifecycleState to) {
    return LEGAL.getOrDefault(from, EnumSet.noneOf(LifecycleState.class)).contains(to);
  }

  /** The set of legal next states from {@code from} (empty for terminal states). */
  public static Set<LifecycleState> legalTargets(LifecycleState from) {
    return EnumSet.copyOf(LEGAL.getOrDefault(from, EnumSet.noneOf(LifecycleState.class)));
  }
}
