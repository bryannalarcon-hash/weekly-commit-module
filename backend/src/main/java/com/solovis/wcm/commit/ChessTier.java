// ChessTier — the "chess layer" ordered priority tiers (KING highest -> PAWN lowest).
// Declaration order IS the priority order, so Enum.ordinal()/compareTo() rank items; KING wins
// ties. Persisted as a string on commit_item.chess_tier (nullable). Swappable to High/Med/Low.
package com.solovis.wcm.commit;

public enum ChessTier {
  KING,
  QUEEN,
  ROOK,
  BISHOP,
  KNIGHT,
  PAWN;

  /** True when this tier outranks {@code other} (appears earlier / higher strategic weight). */
  public boolean outranks(ChessTier other) {
    return this.ordinal() < other.ordinal();
  }
}
