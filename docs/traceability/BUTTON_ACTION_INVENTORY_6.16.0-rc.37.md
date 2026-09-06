# Inventario de botones y acciones — 6.16.0-rc.37

Conteo: 154 botones/enlaces con ID en HTML; 134 elementos `button` verificados por `tests/rc34-control-wiring.js`. Inputs/selects/forms completan 492 IDs y se cubren por `source-references`, `functional-parity`, smoke y suites de módulo.

## Estudio de diseño — inventario uno a uno

| ID | Etiqueta | Permiso | Acción / resultado | Test | Estado |
|---|---|---|---|---|---|
| backToAdminBtn | Volver a Plantillas | sesión | autosave y vuelve con eventId/tab | V5 + wiring | PASS |
| undoBtn / redoBtn | Deshacer / Rehacer | editDraft | historial local de Recipe | rc35/V5 | PASS |
| discardDraftBtn | Descartar borrador | editDraft | confirma, restaura ACTIVE | V5 | PASS |
| saveTemplateBtn | Guardar como plantilla | saveTemplate | CATALOG draft; oculto a cliente | V5 | PASS |
| publishCatalogBtn | Publicar en catálogo | publishCatalog | CATALOG published; oculto a cliente | V5 | PASS |
| previewBtn | Previsualizar borrador | previewDraft | workspace interno DRAFT | V5 | PASS funcional |
| applyBtn | Aplicar cambios a mi invitación | apply | DRAFT→ACTIVE; bloquea doble clic | V5 | PASS |
| moreRecipesBtn | Mostrar más | view | paginación de diseños | rc31 | PASS |
| moreAssetsBtn | Mostrar más | view | paginación lazy | rc31/V5 | PASS |
| openStationeryBtn | Editar sobre y lacre | editStationery | submodo interno | rc28/35/V5 | PASS |
| generatePaletteBtn | Generar armonía | editDraft | teoría de color | rc31/34 | PASS |
| autoAdjustPaletteBtn | Ajustar colores automáticamente | editDraft | aplica variante AA tras warning | V5 contract | PASS funcional |
| duplicateAssetBtn | Duplicar elemento | editDraft | clona instancia sin datos privados | V5 contract | PASS |
| removeAssetBtn | Eliminar elemento | editDraft | retira instancia | rc31/V5 | PASS |
| closeStationeryBtn | Volver al diseño | sesión | restaura panel/contexto | V5 contract | PASS |
| closePreviewBtn | Volver al diseño | sesión | cierra preview sin perder draft | V5 contract | PASS |
| restoreStudioBtn | Restaurar cambios | editStationery | revierte edición local | rc28/29 | PASS |
| applyStudioBtn | Guardar cambios | editStationery | guarda Stationery en DRAFT | rc28–30/V5 | PASS |

Controles de propiedades: `assetX`, `assetY`, `assetScale`, `assetRotation`, `assetZ`, `assetOpacity`, `assetTone`, `assetMotion`, `sectionTextAlign`, `sectionSpacing`, `sectionWidth`, `sectionHeadingSize`, `sectionBodySize`, `sectionHeadingWeight`, `sectionBodyWeight`, `sectionLineHeight`, `sectionLetterSpacing`, `sectionHeadingTone`, `sectionBodyTone`, `sectionHeadingCase`, `sectionSurface`. Resultado: sanitización/persistencia PASS; inspección visual RC37 NOT_RUN.

## Panel — acciones por familia

| Pantalla | IDs de acción inventariados | Permiso | Prueba | Estado |
|---|---|---|---|---|
| Acceso | toggleLoginPassword, loginBtn, showRegisterBtn, googleLoginBtn, toggleRegisterPassword, cancelRegisterBtn | público | smoke/security | PASS |
| Navegación | mobileMenuBtn, dashboardTabBtn, templatesTabBtn, guestsTabBtn, qrTabBtn, tablesLabTabBtn, photosTabBtn, ownerTabBtn, usersTabBtn, billingTabBtn, logoutBtn, topLogoutBtn | rol | mobile-ui/wiring | PASS |
| Evento | newEventBtn, createClientEventBtn, copyPublicEventUrlBtn, publicEventBtn, venueReportBtn, testInviteBtn | rol/eventAllowed | smoke/functional parity | PASS |
| Datos/diseño | saveTypographyBtn, saveDesignKitBtn, resetDesignKitBtn, applyEventTypePresetBtn, autoTranslateBtn, saveLocalizationBtn, restoreDateLabelBtn, addCustomAgendaBtn, saveAgendaBtn, saveGiftBtn | eventAllowed/features | smoke/rc20/24/25 | PASS |
| Multimedia/música | cleanMissingMediaBtn, deleteUploadedMusicBtn, previewUploadFromStartBtn, previewSpotifyLinkBtn, previewSpotifyFromStartBtn, deleteSpotifyMusicBtn, saveMusicSelectionBtn | eventAllowed/music | functional parity/rc32 | PASS |
| Apertura | previewOpeningBtn, openStationeryStudioBtn, openDesignLabBtn | templates | rc28/35/V5 | PASS |
| Brief | saveCreativeBriefBtn, buildCreativePromptBtn, copyCreativePromptBtn | eventAllowed | source references/wiring | PASS |
| Negocio | refreshPublicationRequests, newCommerceProductBtn, refreshCommerceBtn, clientPrevPage, clientNextPage | plataforma | rc23/commerce | PASS |
| Datos seguros | createBackupBtn, inspectBackupBtn, applyBackupRestoreBtn | plataforma | restore/data safety | PASS |
| Compra/publicación | simulateCartBtn, clearCartBtn, submitCartBtn, requestPublicationBtn, copyIncludedUrlBtn | cliente | commerce journeys | PASS |
| Mensajería | queueAutomaticBtn, processAutomaticBtn, refreshAutomaticBtn, sendSelectedBtn, sendPendingBtn | plataforma | WhatsApp readiness | PASS sin envío real |
| Invitados | templateBtn, exportGuestsBtn, deleteSelectedGuestsBtn | eventAllowed | smoke/security XLSX | PASS |
| QR/físico | saveQrDesignBtn, generateQrBtn, downloadQrBtn, downloadQrCardBtn, downloadQrSetBtn, openQrDestinationBtn, downloadPhysicalInviteBtn | qr/print | qr-photo-matrix | PASS funcional |
| Mesas | addRoundTableBtn, addRectTableBtn, addDanceFloorBtn, autoArrangeTablesBtn, saveSeatingLayoutBtn, downloadSeatingPdfBtn, applyUniformTablesBtn, deleteFloorItemBtn | seating | rc23/functional parity | PASS |
| Diálogos/preview | closeUserEditBtn, closeGuestEditBtn, closeClientCommerceBtn, deleteCommercePlanBtn, closeNotificationDetailBtn, notificationDetailAction, closeClientMenuPreviewBtn, openFullPreviewBtn, closeThemePreviewBtn, storePreviewReplay, closeStorePreviewBtn, previewPhoneModeBtn, previewDesktopModeBtn, phonePreviewBtn, storePreviewOpen, closeOpeningPreviewBtn, closeAdminPhotoViewer, previousAdminPhoto, nextAdminPhoto | contextual | rc34 wiring | PASS funcional |

## Público y auxiliares

| Pantalla | IDs | Evidencia | Estado |
|---|---|---|---|
| Invitación | skipOpeningButton, openingEnvelopeButton, musicBtn, spotifyMusicBtn, openInvitationBtn, calendarLink, venueMaps, venueWaze, galleryPrev, galleryNext, rsvpSubmitBtn, spotifyPlayInlineBtn, giftLink, openpayGiftStartBtn, openpayGiftSubmitBtn, eventStudioAttribution, lightboxClose, lightboxPrev, lightboxNext | smoke, rc21–25, rc32/33 | PASS funcional |
| Álbum | photoSubmit, uploadMorePhotos | functional parity | PASS |
| Catálogo | heroTrialCta, heroRecipeNext, builderCta | rc33 | PASS funcional |
| Muestra | sampleCta, samplePrevious, samplePlay, sampleNext | source references | PASS funcional |
| Sandbox | sandboxSaveBtn, sandboxResetBtn, sandboxOpenPreview | source references | PASS funcional |

Toda verificación perceptual/touch real permanece `NOT_RUN` hasta QA físico.
