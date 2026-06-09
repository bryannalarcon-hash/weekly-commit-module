// PageResponse — a FLAT page envelope ({content, totalElements, totalPages, number, size}) matching
// the frontend's TS `Page<T>` contract (libs/types) and the MSW mocks exactly. Spring's PagedModel
// nests the page metadata under a "page" object, which the dashboard/queue screens don't read; this
// projection keeps the wire shape the RTK Query layer expects. Built from a Spring Data Page via
// of().
package com.solovis.wcm.common;

import java.util.List;
import org.springframework.data.domain.Page;

public record PageResponse<T>(
    List<T> content, long totalElements, int totalPages, int number, int size) {

  /** Project a Spring Data Page onto the flat contract shape. */
  public static <T> PageResponse<T> of(Page<T> page) {
    return new PageResponse<>(
        page.getContent(),
        page.getTotalElements(),
        page.getTotalPages(),
        page.getNumber(),
        page.getSize());
  }
}
