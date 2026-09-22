import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const VEHICLE_TYPES = [
  { value: 'Moto', label: 'Aura Moto (1 Seat)', defaultCapacity: 1 },
  { value: 'Auto', label: 'Aura Auto (3 Seats)', defaultCapacity: 3 },
  { value: 'Economy', label: 'Aura Economy (4 Seats)', defaultCapacity: 4 },
  { value: 'Premium', label: 'Aura Premium (4 Seats)', defaultCapacity: 4 },
];

const Register = ({ onSwitchToLogin, onRegisterSuccess }) => {
  const { register, loading } = useAuth();

  const [role, setRole] = useState('rider');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Driver-specific fields
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Economy');
  const [capacity, setCapacity] = useState(4);

  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleVehicleTypeChange = (selectedType) => {
    setVehicleType(selectedType);
    const found = VEHICLE_TYPES.find((v) => v.value === selectedType);
    if (found) {
      setCapacity(found.defaultCapacity);
    }
  };

  const validateForm = () => {
    if (!name.trim()) return 'Full name is required.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (!phone.trim() || phone.trim().length < 7) {
      return 'Please enter a valid phone number.';
    }
    if (!password || password.length < 6) {
      return 'Password must be at least 6 characters long.';
    }

    if (role === 'driver') {
      if (!licenseNumber.trim()) {
        return 'Driver license number is required for drivers.';
      }
      if (!vehicleModel.trim()) {
        return 'Vehicle model (e.g., Toyota Camry) is required.';
      }
      if (!plateNumber.trim()) {
        return 'Vehicle license plate number is required.';
      }
      if (!capacity || Number(capacity) < 1) {
        return 'Vehicle capacity must be at least 1 passenger.';
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setSuccessMessage('');

    const errorMsg = validateForm();
    if (errorMsg) {
      setValidationError(errorMsg);
      return;
    }

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      role,
    };

    if (role === 'driver') {
      payload.licenseNumber = licenseNumber.trim();
      payload.vehicle = {
        model: vehicleModel.trim(),
        plateNumber: plateNumber.trim().toUpperCase(),
        type: vehicleType,
        capacity: Number(capacity),
      };
    }

    const result = await register(payload);
    if (!result.success) {
      setValidationError(result.message);
      return;
    }

    setSuccessMessage(
      `Account created as ${role.toUpperCase()}! Launching your AuraRide workspace...`
    );

    if (typeof onRegisterSuccess === 'function') {
      onRegisterSuccess(result.user);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl shadow-indigo-950/40 p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white font-bold text-xl shadow-lg shadow-indigo-500/30 mb-3">
            A
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Create your AuraRide Account
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Choose your account type to get started
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setRole('rider');
              setValidationError('');
            }}
            className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
              role === 'rider'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Rider</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRole('driver');
              setValidationError('');
            }}
            className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
              role === 'driver'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Driver Partner</span>
          </button>
        </div>

        {validationError && (
          <div
            role="alert"
            className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5"
          >
            <span className="font-semibold shrink-0">Error:</span>
            <span>{validationError}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="reg-name"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label
                htmlFor="reg-phone"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Phone Number
              </label>
              <input
                id="reg-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="reg-email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label
                htmlFor="reg-password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          {/* Driver Vehicle & License Section */}
          {role === 'driver' && (
            <div className="pt-4 mt-2 border-t border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  Driver & Vehicle Details
                </span>
                <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full">
                  Partner Onboarding
                </span>
              </div>

              <div>
                <label
                  htmlFor="reg-license"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                >
                  Driver License Number
                </label>
                <input
                  id="reg-license"
                  type="text"
                  required
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="DL-1420110012345"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="reg-vehicle-model"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    Vehicle Model
                  </label>
                  <input
                    id="reg-vehicle-model"
                    type="text"
                    required
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Hyundai Ioniq 5 / Honda Activa"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-plate"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    Plate Number
                  </label>
                  <input
                    id="reg-plate"
                    type="text"
                    required
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                    placeholder="MH 12 AB 1234"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 uppercase focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="reg-vehicle-type"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    Vehicle Category
                  </label>
                  <select
                    id="reg-vehicle-type"
                    value={vehicleType}
                    onChange={(e) => handleVehicleTypeChange(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                  >
                    {VEHICLE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="reg-capacity"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    Passenger Capacity
                  </label>
                  <input
                    id="reg-capacity"
                    type="number"
                    min="1"
                    max="8"
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/25 transition"
          >
            {loading
              ? 'Creating Account...'
              : role === 'driver'
              ? 'Register as Driver Partner'
              : 'Register as Rider'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-sm text-slate-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-semibold text-indigo-400 hover:text-indigo-300 transition"
            >
              Sign in instead
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
