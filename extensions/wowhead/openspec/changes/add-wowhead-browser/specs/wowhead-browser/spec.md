## ADDED Requirements

### Requirement: User can search retail Wowhead entities
The extension MUST let users search retail Wowhead by free-text query and view matching entries in a Vicinae list.

#### Scenario: Query returns results
- **WHEN** the user enters a non-empty search query
- **THEN** the extension MUST request retail Wowhead search data and render the returned matches

#### Scenario: Query is empty
- **WHEN** the search query is empty
- **THEN** the extension MUST avoid network search requests and show an idle empty state

### Requirement: User can filter search by entity type
The extension MUST provide a type filter that scopes search results to a selected entity type or all supported types.

#### Scenario: Type filter is changed
- **WHEN** the user selects a new entity type
- **THEN** the extension MUST re-run search with that type constraint

### Requirement: User can inspect lightweight preview metadata
Each search result MUST show enough metadata to disambiguate entries before opening full page content.

#### Scenario: Result metadata is shown
- **WHEN** a result row is rendered
- **THEN** the extension MUST show title and include available metadata such as entity type, identifier, and URL path details

### Requirement: User can open full result pages externally
The extension MUST allow opening the selected result in a browser and provide explicit user feedback for the handoff.

#### Scenario: Open action succeeds
- **WHEN** the user triggers the open action
- **THEN** the extension MUST open the selected Wowhead URL, show a success toast, and close the main window

### Requirement: Query data persists across sessions
The extension MUST persist React Query state using a Vicinae Cache-backed persister.

#### Scenario: Session restarts
- **WHEN** the user reopens the command within cache lifetime
- **THEN** previously cached query results MUST be restored before fresh fetches complete

### Requirement: Command handles loading, empty, and failure states
The extension MUST render clear loading/empty/error states and surface failures through toasts.

#### Scenario: Search request fails
- **WHEN** the search request throws an error
- **THEN** the extension MUST show a failure toast with a meaningful message

#### Scenario: Search has no matches
- **WHEN** the search request completes with no results
- **THEN** the extension MUST show a no-results empty state
