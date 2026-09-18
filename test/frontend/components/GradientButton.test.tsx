import { fireEvent, render } from '@testing-library/react-native';
import { GradientButton } from '../../../src/components/GradientButton';

describe('GradientButton', () => {
  it('calls its action when pressed', async () => {
    const onPress = jest.fn();
    const screen = await render(<GradientButton title="Place order" onPress={onPress} />);
    fireEvent.press(screen.getByText('Place order'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call its action when disabled or loading', async () => {
    const disabled = jest.fn();
    const loading = jest.fn();
    const disabledScreen = await render(<GradientButton title="Disabled" onPress={disabled} disabled />);
    const loadingScreen = await render(<GradientButton title="Loading" onPress={loading} loading />);

    fireEvent.press(disabledScreen.getByText('Disabled'));
    expect(disabled).not.toHaveBeenCalled();
    expect(loadingScreen.queryByText('Loading')).toBeNull();
    expect(loading).not.toHaveBeenCalled();
  });
});
