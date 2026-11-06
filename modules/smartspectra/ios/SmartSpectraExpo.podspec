Pod::Spec.new do |s|
  s.name           = 'SmartSpectraExpo'
  s.version        = '0.1.0'
  s.summary        = 'Expo bridge for the Presage SmartSpectra SDK'
  s.description    = 'Exposes SmartSpectra heart rate, breathing rate, HRV and waveforms to JavaScript.'
  s.author         = ''
  s.homepage       = 'https://presagetech.com/smartspectra-sdk'
  s.license        = { type: 'UNLICENSED' }
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # SmartSpectra ships as a Swift Package only. React Native's `spm_dependency` helper
  # (scripts/cocoapods/spm.rb) adds the package to the Pods project at `pod install` time.
  if defined?(spm_dependency)
    spm_dependency(s,
      url: 'https://github.com/Presage-Security/SmartSpectra-Swift',
      requirement: { kind: 'exactVersion', version: '3.4.0' },
      products: ['SmartSpectra']
    )
  else
    raise 'SmartSpectraExpo needs React Native\'s spm_dependency helper (React Native 0.75+).'
  end

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
