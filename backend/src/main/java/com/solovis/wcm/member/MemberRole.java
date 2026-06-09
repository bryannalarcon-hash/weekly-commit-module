// MemberRole — coarse role of a Member: EMPLOYEE (authors commits) or MANAGER (also reviews).
// Persisted as a string on member.role; drives review/roll-up authorization in later units.
package com.solovis.wcm.member;

public enum MemberRole {
  EMPLOYEE,
  MANAGER
}
