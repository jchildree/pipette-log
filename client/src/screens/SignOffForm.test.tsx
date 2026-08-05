import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../toast/ToastProvider';
import SignOffForm from './SignOffForm';
import * as api from '../api';

vi.mock('../api', () => ({
    fetchUsers: vi.fn().mockResolvedValue([{ id: 1, username: 'tech1' }]),
    fetchBalances: vi.fn().mockResolvedValue([{ id: 1, equipment_type: 'Balance', equipment_id: 'BAL-1', calibration_due_date: null, department: null, status: 'Active' }]),
    fetchPipettes: vi.fn().mockResolvedValue([{
        id: 1, equipment_type: 'Pipette', equipment_id: 'PIP-1', category: 'Single', pipette_range: null,
        calibration_due_date: null, low_ul: 10, mid_ul: 50, high_ul: 100, low_usage_ul: null, unit: 'uL',
        status: 'Active', rack_number: null, serial_number: null, sub_location: null, last_calibration_date: null,
        mechanism: null, calibration_conducted_by: null, ranges_used: null, department: null, manufacturer: null,
        old_id: null, review_comment: null, adjustment_comment: null, comments_2: null,
    }]),
    fetchTips: vi.fn().mockResolvedValue([]),
    fetchLatestEntry: vi.fn().mockResolvedValue(null),
    submitEntry: vi.fn().mockResolvedValue({ out_of_service: [] }),
}));

vi.mock('../storage/referenceCache', () => ({
    getCachedUsers: () => [], getCachedBalances: () => [], getCachedPipettes: () => [], getCachedTips: () => [],
    setCachedUsers: () => {}, setCachedBalances: () => {}, setCachedPipettes: () => {}, setCachedTips: () => {},
}));

vi.mock('../network', () => ({ isOnline: () => true }));

// Root-cause repro (Case: Failed verification bypasses hard-fail gate): entering a
// wildly out-of-tolerance mass must never open the Sign Off modal, must never call
// submitEntry, and must leave the operator's entered volume in place.
describe('SignOffForm out-of-tolerance submit', () => {
    it('blocks the sign-off modal and preserves entered volumes when a point is out of tolerance', async () => {
        const user = userEvent.setup();
        render(
            <ToastProvider>
                <SignOffForm />
            </ToastProvider>
        );

        await screen.findByText('PIP-1'); // reference data loaded
        const pipettePicker = document.querySelector('.cardPicker') as HTMLSelectElement;
        await user.selectOptions(pipettePicker, '1');

        const balancePickers = document.querySelectorAll('.cardPicker');
        await user.selectOptions(balancePickers[1] as HTMLSelectElement, '1');

        // Low target pre-filled to 10 uL; entering a wildly wrong mass (100 mg) fails tolerance.
        const massInputs = document.querySelectorAll('.tableCellInput');
        // row order: [low.volume, low.mass, mid.volume, mid.mass, high.volume, high.mass]
        await user.clear(massInputs[1] as HTMLInputElement);
        await user.type(massInputs[1] as HTMLInputElement, '100');
        await user.clear(massInputs[3] as HTMLInputElement);
        await user.type(massInputs[3] as HTMLInputElement, '50');
        await user.clear(massInputs[5] as HTMLInputElement);
        await user.type(massInputs[5] as HTMLInputElement, '100');

        await user.click(screen.getByRole('button', { name: /Sign & Submit/i }));

        await waitFor(() => {
            expect(screen.queryByText('Sign Off')).not.toBeInTheDocument();
        });
        expect(api.submitEntry).not.toHaveBeenCalled();
        // Volume field for the failed Low point must still hold its default (10), not be wiped.
        expect((massInputs[0] as HTMLInputElement).value).toBe('10');
    });
});
