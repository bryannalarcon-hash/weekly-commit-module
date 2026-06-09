// CommitController — REST surface for the weekly-commit CRUD + submit (U11), RTK-Query friendly
// (resource-oriented paths, JSON bodies, stable status codes). All identity/ownership decisions
// live in CommitService (the acting member comes from CurrentMemberProvider, resolved from the
// Auth0 JWT subject under U15 — never the body). Errors are rendered as RFC-7807 ProblemDetail by
// ApiExceptionHandler. All routes require a valid bearer token (see SecurityConfig).
package com.solovis.wcm.commit;

import com.solovis.wcm.commit.dto.CommitDto;
import com.solovis.wcm.commit.dto.CreateCommitRequest;
import com.solovis.wcm.commit.dto.UpdateCommitRequest;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/commits")
public class CommitController {

  private final CommitService service;

  public CommitController(CommitService service) {
    this.service = service;
  }

  @Operation(summary = "Create a DRAFT weekly commit owned by the acting member (from the JWT)")
  @PostMapping
  public ResponseEntity<CommitDto> create(@Valid @RequestBody CreateCommitRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
  }

  @Operation(summary = "List the acting member's own weekly commits")
  @GetMapping
  public List<CommitDto> listMine() {
    return service.listMine();
  }

  @Operation(summary = "Read a weekly commit (ownership-checked: 403 if not the acting member's)")
  @GetMapping("/{id}")
  public CommitDto get(@PathVariable UUID id) {
    return service.get(id);
  }

  @Operation(summary = "Replace a DRAFT commit's items (409 if the commit is LOCKED or later)")
  @PutMapping("/{id}")
  public CommitDto update(@PathVariable UUID id, @Valid @RequestBody UpdateCommitRequest request) {
    return service.update(id, request);
  }

  @Operation(summary = "Submit (DRAFT -> LOCKED); 422 if any item is unlinked")
  @PostMapping("/{id}/submit")
  public CommitDto submit(@PathVariable UUID id) {
    return service.submit(id);
  }
}
