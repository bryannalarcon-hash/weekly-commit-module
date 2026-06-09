// TeamType — classifies a Team as a GROUP (a working squad) or a DEPARTMENT (an org unit).
// Persisted as a string (EnumType.STRING) on team.type; used to shape the org hierarchy.
package com.solovis.wcm.member;

public enum TeamType {
  GROUP,
  DEPARTMENT
}
