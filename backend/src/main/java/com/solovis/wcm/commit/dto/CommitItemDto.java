// CommitItemDto — wire shape of one CommitItem in API responses (U10/U11). Mirrors the live item:
// id, text, status (ACTUAL), supportingOutcomeId (nullable per KTD5), chessTier, and the
// carriedFromItemId lineage. Mirrored 1:1 by the TS CommitItemDto in libs/types.
package com.solovis.wcm.commit.dto;

import com.solovis.wcm.commit.ChessTier;
import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemStatus;
import java.util.UUID;

public record CommitItemDto(
    UUID id,
    String text,
    CommitItemStatus status,
    UUID supportingOutcomeId,
    ChessTier chessTier,
    UUID carriedFromItemId) {

  /** Project a persisted CommitItem onto its wire shape. */
  public static CommitItemDto from(CommitItem item) {
    return new CommitItemDto(
        item.getId(),
        item.getText(),
        item.getStatus(),
        item.getSupportingOutcomeId(),
        item.getChessTier(),
        item.getCarriedFromItemId());
  }
}
