/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TableView from '../../app/components/TableView';

// Mock useIsMobile hook
jest.mock('../../app/hooks/useIsMobile', () => ({
  __esModule: true,
  default: jest.fn(() => false), // Default to desktop
}));

// Mock dataService so the fishmeal fetch resolves deterministically
jest.mock('../../services/dataService', () => ({
  dataService: {
    getFishmealPlants: jest.fn(() =>
      Promise.resolve({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [120.38264, 36.0671] },
            properties: {
              id: '1',
              name: 'Test Fishmeal Plant',
              chineseName: '测试鱼粉厂',
              province: 'Shandong Province',
              city: 'Qingdao',
              address: 'No. 1, Test Road',
              kind: 'fishmeal_plant'
            }
          }
        ]
      })
    )
  }
}));

import useIsMobile from '../../app/hooks/useIsMobile';

describe('TableView Component', () => {
  const mockData = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Farm A',
          chineseName: '农场A',
          province: 'Xinjiang Uyghur Autonomous Region',
          established: '2020-01-01'
        },
        geometry: { type: 'Point', coordinates: [85, 42] }
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useIsMobile.mockReturnValue(false);
    global.URL.createObjectURL = jest.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  describe('Fishmeal Plants CSV download', () => {
    it('renders a fishmeal plants download button with the plant count', async () => {
      render(<TableView geojsonData={mockData} onBackToMap={jest.fn()} />);

      expect(await screen.findByText(/Fishmeal Plants CSV \(1\)/)).toBeInTheDocument();
    });

    it('downloads a plant CSV with plant-appropriate columns when clicked', async () => {
      const user = userEvent.setup();
      let blobParts;
      const OrigBlob = global.Blob;
      jest.spyOn(global, 'Blob').mockImplementation((parts, opts) => {
        blobParts = parts;
        return new OrigBlob(parts, opts);
      });

      render(<TableView geojsonData={mockData} onBackToMap={jest.fn()} />);

      const button = await screen.findByText(/Fishmeal Plants CSV/);
      await user.click(button);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      const csv = blobParts[0];
      expect(csv).toContain('Name,Chinese Name,Province,City,Address,Lat (WGS84),Lon (WGS84)');
      expect(csv).toContain('Test Fishmeal Plant');
      expect(csv).toContain('测试鱼粉厂');
      expect(csv).toContain('"No. 1, Test Road"');
    });

    it('renders the fishmeal download button in the mobile layout', async () => {
      useIsMobile.mockReturnValue(true);
      render(<TableView geojsonData={mockData} onBackToMap={jest.fn()} />);

      expect(await screen.findByText(/Fishmeal Plants \(1\)/)).toBeInTheDocument();
    });
  });
});
