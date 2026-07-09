<script lang="ts">
	let {
		open = false,
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		onconfirm,
		oncancel
	}: {
		open?: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();

	const uid = $props.id();

	let dialog = $state<HTMLDialogElement | null>(null);

	// Native <dialog> gives us the focus trap, Esc handling and backdrop.
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	// Fires on Esc as well as on programmatic close; only propagate the
	// cancel intent when the parent still believes the dialog is open.
	function handleClose() {
		if (open) {
			oncancel();
		}
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="{uid}-title"
	aria-describedby="{uid}-message"
	onclose={handleClose}
	class="m-auto w-full max-w-md rounded-xl border border-border-dark bg-surface-dark p-0 text-white shadow-2xl backdrop:bg-black/70"
>
	<div class="flex flex-col gap-4 p-6">
		<div class="flex items-center gap-3 text-danger">
			<span class="material-symbols-outlined" aria-hidden="true">warning</span>
			<h2 id="{uid}-title" class="text-lg font-bold text-white">{title}</h2>
		</div>
		<p id="{uid}-message" class="text-sm text-text-muted">{message}</p>
		<div class="mt-2 flex justify-end gap-3">
			<!-- Cancel comes first in DOM order so showModal() focuses the safe action -->
			<button
				onclick={() => oncancel()}
				class="rounded-lg border border-border-dark bg-background-dark px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-border-dark"
			>
				{cancelLabel}
			</button>
			<button
				onclick={() => onconfirm()}
				class="rounded-lg bg-danger px-4 py-2 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition-colors hover:bg-red-600"
			>
				{confirmLabel}
			</button>
		</div>
	</div>
</dialog>
