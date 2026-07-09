import { describe, it, expect, vi } from 'vitest';
// Also imported by vitest-setup.ts at runtime; this import puts the matcher
// type augmentation in scope for svelte-check, which excludes root-level files.
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import ConfirmDialog from './ConfirmDialog.svelte';

function renderDialog(open = true) {
	const onconfirm = vi.fn();
	const oncancel = vi.fn();
	const utils = render(ConfirmDialog, {
		props: {
			open,
			title: 'Halt all quoting?',
			message: 'Every open order is cancelled immediately.',
			confirmLabel: 'Halt quoting',
			onconfirm,
			oncancel
		}
	});
	return { onconfirm, oncancel, ...utils };
}

describe('ConfirmDialog', () => {
	it('shows title and message as a modal when open', async () => {
		renderDialog(true);
		await tick();

		const dialog = screen.getByRole('dialog');
		expect(dialog).toBeInTheDocument();
		expect(screen.getByText('Halt all quoting?')).toBeInTheDocument();
		expect(screen.getByText('Every open order is cancelled immediately.')).toBeInTheDocument();
	});

	it('stays closed when open is false', async () => {
		renderDialog(false);
		await tick();

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('fires onconfirm only from the confirm button', async () => {
		const { onconfirm, oncancel } = renderDialog(true);
		await tick();

		await fireEvent.click(screen.getByRole('button', { name: 'Halt quoting' }));

		expect(onconfirm).toHaveBeenCalledOnce();
		expect(oncancel).not.toHaveBeenCalled();
	});

	it('fires oncancel from the cancel button without confirming', async () => {
		const { onconfirm, oncancel } = renderDialog(true);
		await tick();

		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(oncancel).toHaveBeenCalledOnce();
		expect(onconfirm).not.toHaveBeenCalled();
	});

	it('treats a native close (Esc) as a cancel', async () => {
		const { onconfirm, oncancel } = renderDialog(true);
		await tick();

		const dialog = screen.getByRole('dialog');
		// jsdom does not simulate the Esc key for <dialog>; the native close
		// event it would produce is what the component listens to.
		await fireEvent(dialog, new Event('close'));

		expect(oncancel).toHaveBeenCalledOnce();
		expect(onconfirm).not.toHaveBeenCalled();
	});
});
